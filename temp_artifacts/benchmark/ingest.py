#!/usr/bin/env python3
"""Ingest student submissions for the AI-Debug benchmark — PII-consciously.

What this does
--------------
Walks an input directory of saved submissions and emits a clean, **PII-free**
JSONL manifest the benchmark can run `/api/debug` over and score.

It handles two input shapes:

1. **Code files** (`.cpp/.cc/.cxx/.java/.py`) — THE recommended capture format.
   The code is the file body; the problem + status are read from the *filename*
   (see the naming contract in benchmark/README.md). No student PII is involved.

2. **Saved HTML pages** (`.html`) — detected and REJECTED when they are the
   logged-out Next.js shell. A plain browser "Save As" of the AlgoPro submission
   page (`/[id]`, client-rendered behind auth) saves only the pre-hydration shell
   ("Please log in to access this page.", empty `__NEXT_DATA__.pageProps`), so it
   carries no code. The ingest flags these as EMPTY_CAPTURE instead of silently
   producing nothing. (If a future, authenticated capture ever lands the data in
   `pageProps`, we extract it; today it won't, hence the recommendation above.)

Privacy: only code + problem + status are extracted. Filenames are expected to be
problem-based (no names). The script never prints code or any file body to stdout
— only counts and problem ids. Output lives under temp_artifacts/benchmark/data/ which is
git-ignored, so neither raw captures nor parsed code are ever committed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

# ---- Config (override via CLI) ---------------------------------------------
DEFAULT_INPUT = Path("temp_artifacts/benchmark/data/raw")
DEFAULT_OUTPUT = Path("temp_artifacts/benchmark/data/parsed/manifest.jsonl")

CODE_EXTS: dict[str, str] = {
    ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".cppfile": "cpp",
    ".java": "java",
    ".py": "py", ".python": "py",
}

# Markers that identify the logged-out, no-data Next.js shell.
SHELL_MARKERS = ("Please log in to access this page", '"pageProps":{}')

# Status tokens in a filename (case-insensitive, matched as a whole word-ish run).
CORRECT_RE = re.compile(r"(?:^|[^a-z])correct(?:[^a-z]|$)", re.IGNORECASE)
WRONG_RE = re.compile(r"(?:^|[^a-z])(?:wrong|incorrect|wa|tle|rte|fail)(?:[^a-z]|$)",
                      re.IGNORECASE)

# Problem id from a page-title-style name, e.g.
#   "Codeforces 242E_ XOR on Segment - AlgoPro IDE"
#   "CSES 1739_ Forest Queries II"
#   "njudge V24_MexFa_ Vállalati ügyelet"   (':' and '/' became '_' on save)
PROBLEM_RE = re.compile(
    r"^\s*(?P<platform>[A-Za-z.]+)\s+(?P<pid>[A-Za-z0-9_]+?)_\s*(?P<title>.+?)"
    r"(?:\s*-\s*AlgoPro IDE)?$"
)


@dataclass
class Record:
    id: str
    status: str           # "correct" | "incorrect" | "unknown"
    language: str | None
    platform: str | None
    problem_id: str | None
    problem_title: str | None
    code_sha256: str
    code_chars: int
    code: str
    source_basename: str  # problem-based filename (kept for debugging; PII-free by contract)


@dataclass
class Skip:
    source_basename: str
    reason: str           # "EMPTY_CAPTURE" | "html-with-data-unsupported" | "unknown-extension" | ...
    detail: str = ""


@dataclass
class Result:
    records: list[Record] = field(default_factory=list)
    skips: list[Skip] = field(default_factory=list)


def detect_status(name: str) -> str:
    """correct / incorrect / unknown — never silently assume a missing label."""
    if CORRECT_RE.search(name):
        return "correct"
    if WRONG_RE.search(name):
        return "incorrect"
    return "unknown"


def parse_problem(stem: str) -> tuple[str | None, str | None, str | None]:
    """(platform, problem_id, title) best-effort from a page-title-style stem."""
    # Drop a leading status token so "wrong__CSES 1739_ …" still parses.
    cleaned = re.sub(r"^\s*(?:correct\d*|wrong|incorrect|wa|tle|rte|fail)\s*[_-]*\s*",
                     "", stem, flags=re.IGNORECASE)
    m = PROBLEM_RE.match(cleaned)
    if not m:
        return None, None, None
    pid = m.group("pid").replace("_", "/")  # '_' was ':' or '/' on save
    return m.group("platform"), pid, m.group("title").strip()


def classify_html(text: str) -> Skip | None:
    """Return a Skip if this HTML is the empty logged-out shell, else None
    (meaning it *might* carry data — currently unsupported, flagged separately)."""
    if any(marker in text for marker in SHELL_MARKERS):
        return Skip("", "EMPTY_CAPTURE",
                    "logged-out Next.js shell (no code/problem in saved HTML)")
    return None


def ingest_file(path: Path, next_id: int) -> Record | Skip:
    name = path.name
    ext = path.suffix.lower()

    if ext in (".html", ".htm"):
        text = path.read_text(encoding="utf-8", errors="replace")
        shell = classify_html(text)
        if shell:
            shell.source_basename = name
            return shell
        return Skip(name, "html-with-data-unsupported",
                    "non-shell HTML; add a DOM/pageProps extractor when this appears")

    lang = CODE_EXTS.get(ext)
    if lang is None:
        return Skip(name, "unknown-extension", f"ext {ext!r} not a recognised code file")

    code = path.read_text(encoding="utf-8", errors="replace")
    if not code.strip():
        return Skip(name, "empty-file", "code file had no content")

    stem = path.stem
    platform, problem_id, title = parse_problem(stem)
    return Record(
        id=f"sub_{next_id:04d}",
        status=detect_status(name),
        language=lang,
        platform=platform,
        problem_id=problem_id,
        problem_title=title,
        code_sha256=hashlib.sha256(code.encode("utf-8")).hexdigest(),
        code_chars=len(code),
        code=code,
        source_basename=name,
    )


def ingest_dir(input_dir: Path) -> Result:
    result = Result()
    files = sorted(
        p for p in input_dir.iterdir()
        if p.is_file() and not p.name.startswith(".") and "__MACOSX" not in p.parts
    )
    n = 1
    for path in files:
        out = ingest_file(path, n)
        if isinstance(out, Record):
            result.records.append(out)
            n += 1
        else:
            result.skips.append(out)
    return result


def pair_candidates(records: list[Record]) -> list[tuple[str, str]]:
    """Wrong→correct pairs on the same problem — the free ground-truth signal."""
    pairs: list[tuple[str, str]] = []
    by_problem: dict[str, list[Record]] = {}
    for r in records:
        if r.problem_id:
            by_problem.setdefault(r.problem_id, []).append(r)
    for recs in by_problem.values():
        wrong = [r for r in recs if r.status == "incorrect"]
        right = [r for r in recs if r.status == "correct"]
        for w in wrong:
            for c in right:
                pairs.append((w.id, c.id))
    return pairs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = ap.parse_args()

    if not args.input.is_dir():
        print(f"[ingest] input dir not found: {args.input}", file=sys.stderr)
        return 2

    result = ingest_dir(args.input)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        for r in result.records:
            f.write(json.dumps(asdict(r), ensure_ascii=False) + "\n")

    # ---- Summary (counts + problem ids only; never code/PII) ----------------
    by_status: dict[str, int] = {}
    for r in result.records:
        by_status[r.status] = by_status.get(r.status, 0) + 1
    skip_reasons: dict[str, int] = {}
    for s in result.skips:
        skip_reasons[s.reason] = skip_reasons.get(s.reason, 0) + 1

    print(f"[ingest] input: {args.input}")
    print(f"[ingest] parsed {len(result.records)} submission(s) -> {args.output}")
    print(f"[ingest]   by status: {by_status or '(none)'}")
    for r in result.records:
        prob = f"{r.platform} {r.problem_id}" if r.problem_id else "(problem unknown)"
        print(f"[ingest]     {r.id}  {r.status:<9} {r.language:<4} {prob}")
    print(f"[ingest] skipped {len(result.skips)} file(s): {skip_reasons or '(none)'}")
    for s in result.skips:
        print(f"[ingest]     SKIP [{s.reason}] {s.source_basename}  — {s.detail}")
    pairs = pair_candidates(result.records)
    print(f"[ingest] wrong->correct pair candidates (ground truth): {len(pairs)}")
    for w, c in pairs:
        print(f"[ingest]     pair  {w} (incorrect) <-> {c} (correct)")

    if not result.records:
        print("[ingest] WARNING: 0 usable submissions — see skips above. "
              "If everything is EMPTY_CAPTURE, the captures are logged-out shells; "
              "see benchmark/README.md for a capture method that works.",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
