#!/usr/bin/env python3
"""Migrate legacy files/*/state/judge_resuts arrays to compact result fields.

The input may contain either the database root or the "files" object.
"""

import argparse
import json
import math
import os
import re
from pathlib import Path
from typing import Any

TOOLS_DIR = Path(__file__).resolve().parent.parent
PROJECT_ID = "algopro-app"
DB_URL_PROD = f"https://{PROJECT_ID}-default-rtdb.firebaseio.com"
DB_URL_EMULATOR = f"http://127.0.0.1:9000/?ns={PROJECT_ID}-default-rtdb"
SAMPLE_DESCRIPTION = re.compile(r"^Sample(?: (\d+))?: ")
EMPTY_RESULT_FIELDS = {
    "compilationMessage",
    "fileOutput",
    "message",
    "stderr",
    "stdout",
}
STATUS_DESCRIPTIONS = {
    "success": "Successful",
    "compile_error": "Compilation Error",
    "runtime_error": "Runtime Error",
    "memory_limit_exceeded": "Memory Limit Exceeded",
    "internal_error": "Internal Server Error",
    "time_limit_exceeded": "Time Limit Exceeded",
    "wrong_answer": "Wrong Answer",
}


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--apply", action="store_true", help="Write changes (default: dry run)"
)
parser.add_argument(
    "--emulator", action="store_true", help="Use the local RTDB emulator"
)
parser.add_argument("--input", type=Path, help="Read a Firebase JSON export")
args = parser.parse_args()

def indexed_values(value: Any) -> dict[int, Any]:
    if isinstance(value, list):
        return {index: item for index, item in enumerate(value) if item is not None}
    if isinstance(value, dict):
        return {
            int(index): item
            for index, item in value.items()
            if str(index).isdecimal() and item is not None
        }
    return {}


def number(value: Any) -> int | float | None:
    if isinstance(value, bool) or value in (None, ""):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(parsed):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def compact_result(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not isinstance(value.get("status"), str):
        return None

    result = {}
    for key, field_value in value.items():
        if key == "fileOutput" or (key in EMPTY_RESULT_FIELDS and field_value == ""):
            continue
        if key in ("time", "memory", "signal"):
            field_value = number(field_value)
            if field_value is None or (key == "signal" and field_value <= 0):
                continue
        result[key] = field_value

    if result.get("statusDescription") == STATUS_DESCRIPTIONS.get(result["status"]):
        del result["statusDescription"]

    return result


def migrate_legacy_results(
    legacy: Any,
) -> tuple[dict[str, Any], list[str]]:
    entries = indexed_values(legacy)
    updates: dict[str, Any] = {}

    input_result = compact_result(entries.get(0))
    if input_result and not str(input_result.get("statusDescription", "")).startswith(
        ("Sample:", "Sample ", "Sample Verdicts:")
    ):
        updates["input_judge_result"] = input_result

    sample_candidates: dict[int, list[tuple[int, dict[str, Any], bool]]] = {}
    for old_index, value in sorted(entries.items()):
        result = compact_result(value)
        if not result:
            continue
        match = SAMPLE_DESCRIPTION.match(str(result.get("statusDescription", "")))
        if not match:
            continue

        sample_index = int(match.group(1) or 1) - 1
        result["statusDescription"] = SAMPLE_DESCRIPTION.sub(
            "", str(result.get("statusDescription", "")), count=1
        )
        if result["statusDescription"] == STATUS_DESCRIPTIONS.get(result["status"]):
            del result["statusDescription"]
        sample_candidates.setdefault(sample_index, []).append(
            (old_index, result, match.group(1) is None)
        )

    samples: dict[int, dict[str, Any]] = {}
    conflicts: list[str] = []
    for sample_index, candidates in sample_candidates.items():
        distinct = []
        comparable_results = []
        for candidate in candidates:
            comparable = {
                key: value
                for key, value in candidate[1].items()
                if key not in ("time", "memory", "signal")
            }
            if comparable in comparable_results:
                continue
            distinct.append(candidate)
            comparable_results.append(comparable)

        if len(distinct) == 1:
            samples[sample_index] = distinct[0][1]
            continue

        successful = [
            candidate
            for candidate in distinct
            if candidate[2] and candidate[1]["status"] == "success"
        ]
        if all(candidate[2] for candidate in distinct) and len(successful) == 1:
            samples[sample_index] = successful[0][1]
            continue

        indices = ", ".join(str(candidate[0]) for candidate in distinct)
        conflicts.append(
            f"sample {sample_index + 1} has conflicting legacy entries "
            f"at array indices {indices}"
        )

    if samples:
        last_index = max(samples)
        updates["sample_judge_results"] = [
            samples.get(index) for index in range(last_index + 1)
        ]

    return updates, conflicts


def main() -> None:
    dry_run = not args.apply
    db = None
    if args.input:
        print(f"Loading files from {args.input}...")
        with open(args.input) as file:
            exported_data = json.load(file)
        files = exported_data.get("files", exported_data)
        source = f"JSON export ({args.input})"

    if not args.input or args.apply:
        import firebase_admin
        import firebase_admin.db
        from firebase_admin import credentials

        if args.emulator:
            os.environ["FIREBASE_DATABASE_EMULATOR_HOST"] = "127.0.0.1:9000"
            cred_file = TOOLS_DIR / "dummyServiceAccountKey.json"
            db_url = DB_URL_EMULATOR
        else:
            cred_file = TOOLS_DIR / "serviceAccountKey.json"
            db_url = DB_URL_PROD
            if not cred_file.exists():
                raise FileNotFoundError(f"{cred_file} not found.")

        with open(cred_file) as file:
            credential = credentials.Certificate(json.load(file))
        firebase_admin.initialize_app(credential, {"databaseURL": db_url})
        db = firebase_admin.db

    if not args.input:
        print("Fetching all files...")
        files = db.reference("files").get() or {}
        source = f"RTDB ({db_url})"

    updates: dict[str, Any] = {}
    legacy_sets = 0
    migrated = 0
    conflicts = 0
    skipped = 0
    old_bytes = 0
    new_bytes = 0

    for file_id, file_data in files.items():
        state = (file_data or {}).get("state", {})
        legacy = state.get("judge_resuts")
        if not isinstance(legacy, (list, dict)) or (
            isinstance(legacy, dict)
            and any(not str(index).isdecimal() for index in legacy)
        ):
            continue

        legacy_sets += 1
        migrated_state, file_conflicts = migrate_legacy_results(legacy)
        conflicts += len(file_conflicts)
        if file_conflicts:
            skipped += 1
            for conflict in file_conflicts:
                print(f"WARNING {file_id}: {conflict}")
            continue

        old_bytes += len(json.dumps(legacy, separators=(",", ":")))
        new_bytes += len(json.dumps(migrated_state, separators=(",", ":")))
        migrated += 1

        updates[f"files/{file_id}/state/judge_resuts"] = None
        for key, value in migrated_state.items():
            updates[f"files/{file_id}/state/{key}"] = value

    print(f"Source: {source}")
    print(f"Mode: {'DRY RUN' if dry_run else 'APPLY'}")
    print(f"Files inspected: {len(files)}")
    print(f"Legacy result sets: {legacy_sets}")
    print(f"Migrated result sets: {migrated}")
    print(f"Skipped result sets: {skipped}")
    print(f"Unresolved conflicts: {conflicts}")
    print(f"Result JSON bytes: {old_bytes} -> {new_bytes}")

    if dry_run or not updates:
        return
    if input("Apply these RTDB updates? Type 'Yes' to confirm: ") != "Yes":
        print("Aborted.")
        return

    batch_size = 500
    paths = list(updates)
    for start in range(0, len(paths), batch_size):
        batch_paths = paths[start : start + batch_size]
        assert db is not None
        db.reference().update({path: updates[path] for path in batch_paths})
        print(f"Wrote {len(batch_paths)} paths")


if __name__ == "__main__":
    main()
