# AI-Debug benchmark

Measure how well `/api/debug` locates bugs in **real student submissions**:
accuracy (does it flag the line that was actually wrong?), false-positive rate
(does it stay quiet on correct code?), and cost/latency (already logged per call
in `.ai-logs/debug.jsonl`).

## ⚠️ Capturing submissions — browser "Save As" does NOT work

A plain **Ctrl+S / "Save As"** of a submission page (`/[id]`) saves only the
**logged-out Next.js shell** — the body is literally *"Please log in to access
this page."* and `__NEXT_DATA__.pageProps` is empty. The page is client-rendered
behind auth, so the code + problem are fetched *after* hydration and never reach
the saved file. (Proof: every such save is byte-identical regardless of the
submission.) `ingest.py` detects these and reports `EMPTY_CAPTURE`.

Use one of these instead:

1. **Copy the code text (recommended, minimal effort).** In the submission view,
   click into the editor, select-all, copy, and paste into a plain code file
   named per the contract below. The problem comes from the filename; correctness
   from the `correct`/`wrong` prefix. No PII involved.

2. **Firebase read-only export (best at scale).** With teacher/admin read access,
   export the submissions collection; this also carries the verdict + timestamp,
   so wrong→accepted pairs can be reconstructed automatically. Hand me the JSON
   shape and I'll add a direct ingester for it.

## Naming contract for code files

```
<status>__<platform> <problem-id>_ <title>.<ext>
```

- **status**: `correct` or `wrong` (also `incorrect`/`wa`/`tle`/`rte`/`fail`).
  Missing → recorded as `unknown` (never silently assumed wrong).
- **ext**: `.cpp`/`.cc`/`.cxx` → C++, `.java` → Java, `.py` → Python.
- **pairs (the best ground truth)**: drop BOTH a student's failing file and their
  later **accepted** file for the same problem. `ingest.py` auto-pairs them by
  problem id — the wrong→fixed *diff* is the bug-location ground truth, for free.

Examples:
```
wrong__CSES 1739_ Forest Queries II.cpp
correct__CSES 1739_ Forest Queries II.cpp
wrong__Codeforces 242E_ XOR on Segment.cpp
```

## Run

```bash
uv run python temp_artifacts/benchmark/ingest.py --input <dir-of-files> \
    --output temp_artifacts/benchmark/data/parsed/manifest.jsonl
```

Emits PII-free JSONL: `{id, status, language, platform, problem_id,
problem_title, code, code_sha256, code_chars, source_basename}`. The summary
prints counts, per-submission problem ids, skips (with reasons), and wrong→correct
pair candidates — never code or names.

## Privacy

Only **code + problem + status** are extracted. Keep filenames problem-based (no
student names). Everything under `temp_artifacts/benchmark/data/` is git-ignored, so neither raw
captures nor parsed code is ever committed.

## Next (not built yet)

- `score.py`: run `/api/debug` over each record; for **pairs**, score finding-vs-
  fix-line overlap; for **correct** records, score the false-positive rate (should
  return no findings). Cost/tokens/latency come free from `.ai-logs/debug.jsonl`.
- Optional `/api/debug` upgrade the user asked for: a **find → double-check →
  keep-only-verified** loop, so it only reports bugs it can confirm and otherwise
  returns "no issues found" (raising precision / lowering false positives on
  correct code).
