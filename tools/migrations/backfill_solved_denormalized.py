#!/usr/bin/env python3

import argparse
import json
import os
from pathlib import Path

import firebase_admin
import firebase_admin.db
from firebase_admin import credentials

TOOLS_DIR = Path(__file__).resolve().parent.parent
PROJECT_ID = "algopro-app"
DB_URL_PROD = f"https://{PROJECT_ID}-default-rtdb.firebaseio.com"
DB_URL_EMULATOR = f"http://127.0.0.1:9000/?ns={PROJECT_ID}-default-rtdb"

PLATFORMS = [
    "codeforces",
    "cses",
    "atcoder",
    "spoj",
    "usaco",
    "planets",
    "ojuz",
    "njudge",
]

parser = argparse.ArgumentParser(
    description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
)
parser.add_argument(
    "--apply",
    action="store_true",
    help="Write changes to the database (default: dry run)",
)
parser.add_argument(
    "--emulator", action="store_true", help="Use local Firebase emulator"
)
args = parser.parse_args()

dry_run = not args.apply

if args.emulator:
    os.environ["FIREBASE_DATABASE_EMULATOR_HOST"] = "127.0.0.1:9000"
    cred_file = TOOLS_DIR / "dummyServiceAccountKey.json"
    db_url = DB_URL_EMULATOR
else:
    cred_file = TOOLS_DIR / "serviceAccountKey.json"
    db_url = DB_URL_PROD
    if not cred_file.exists():
        raise FileNotFoundError(f"{cred_file} not found.")

with open(cred_file) as f:
    cred = credentials.Certificate(json.load(f))

firebase_admin.initialize_app(cred, {"databaseURL": db_url})
db = firebase_admin.db

print(f"Connected to RTDB ({db_url})")
print(f"Mode: {'DRY RUN' if dry_run else 'APPLY'}")
print()

print("Fetching all users...")
users_snap = db.reference("users").get(shallow=True)
if not users_snap:
    print("No users found.")
    exit(0)

user_ids = list(users_snap.keys())
print(f"Found {len(user_ids)} users.\n")

updates: dict[str, bool] = {}
skipped_no_problem = 0
already_set = 0
to_backfill = 0

for i, uid in enumerate(user_ids, 1):
    print(f"[{i}/{len(user_ids)}] Processing user {uid}...", end=" ", flush=True)

    user_data = db.reference(f"users/{uid}").get() or {}
    user_updates = 0

    for platform in PLATFORMS:
        platform_key = f"platform-{platform}"
        platform_data = user_data.get(platform_key, {}) or {}

        id_to_file: dict[str, str] = (
            platform_data.get("problem-id-to-file-id", {}) or {}
        )
        already_solved: dict[str, bool] = platform_data.get("solved", {}) or {}

        for problem_id, file_id in id_to_file.items():
            if already_solved.get(problem_id):
                already_set += 1
                continue

            # Check if this file is marked solved
            solved = db.reference(f"files/{file_id}/solvedStatus/solved").get()
            if not solved:
                skipped_no_problem += 1
                continue

            path = f"users/{uid}/{platform_key}/solved/{problem_id}"
            updates[path] = True
            user_updates += 1
            to_backfill += 1

    print(f"{user_updates} new solved entries")

print()
print("Summary:")
print(f"  Already denormalized (skipped): {already_set}")
print(f"  Not solved (skipped):           {skipped_no_problem}")
print(f"  To backfill:                    {to_backfill}")
print()

if to_backfill == 0:
    print("Nothing to do.")
    exit(0)

if dry_run:
    print("DRY RUN - no changes written. Re-run with --apply to apply.")
    print()
    print("Sample of paths that would be written (up to 20):")
    for path in list(updates.keys())[:20]:
        print(f"  {path} = true")
else:
    if input(f"Write {to_backfill} entries to RTDB? Type 'Yes' to confirm: ") != "Yes":
        print("Aborted.")
        exit(0)

    # RTDB multi-path update is limited to ~1000 paths per call
    BATCH_SIZE = 500
    paths = list(updates.keys())
    for start in range(0, len(paths), BATCH_SIZE):
        batch = {p: updates[p] for p in paths[start : start + BATCH_SIZE]}
        db.reference().update(batch)
        print(f"  Wrote batch {start // BATCH_SIZE + 1} ({len(batch)} entries)")

    print(f"\nDone. {to_backfill} entries written.")
