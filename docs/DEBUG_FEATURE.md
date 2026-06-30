# AI "Debug" feature

A **Debug** button next to **Run Code** sends the student's current code and the
problem statement to an AI (the `claude` CLI / Claude Code) and **highlights the
lines the AI thinks contain bugs** — without, by default, telling the student
what the bug is. It is a nudge ("look here"), not a solution.

This document describes the design and — importantly — **how to customise the
decisions made here**, since the original feature request was deliberately
under-specified.

## UX at a glance

1. Student writes code in the editor and clicks **Debug**.
2. The button shows a spinner while the AI analyses (~5–15 s).
3. Suspect lines get a translucent red full-line highlight, a dot in the glyph
   margin, and a mark on the overview ruler.
4. Highlights clear when the student clicks **Run Code** or **Debug** again.
5. If the AI finds nothing, an alert says so. Errors surface via an alert with a
   distinct error code.

By design **v1 only highlights** — it does not reveal the reason. The reason is
still returned by the API (so turning it on is a one-line change) but is hidden
in the UI. See `showReasons` below.

## Architecture / data flow

```
DebugButton (NavBar)
  └─ handleDebugCode()                     pages/[id].tsx
       ├─ getMainEditorValue()             current code from the Monaco/CodeMirror atom
       ├─ fetchProblemFromDb()             problem statement (if a problem is attached)
       └─ requestDebug()                   src/scripts/requestDebug.ts  ── POST /api/debug
                                                                              │
                            pages/api/debug.ts  (server, in the `web` container)
                              ├─ build a prompt: problem + line-numbered code
                              ├─ spawn `claude --print --output-format json --model sonnet
                              │         --dangerously-skip-permissions --disallowed-tools …
                              │         --append-system-prompt <JSON contract>
                              │   (prompt on stdin; CLAUDE_CODE_OAUTH_TOKEN from env)
                              └─ parse envelope → extract {buggyLines:[{line,reason}], summary}
                                                                              │
  setBugHighlights(lines)  ◄───────────────────────────────────────────────┘
  editorEnhancements.ts → Monaco decorations collection (class `debug-bug-highlight`)
```

## Files

**Added**
- `pages/api/debug.ts` — the backend endpoint; shells out to the `claude` CLI.
- `src/scripts/requestDebug.ts` — typed `fetch` client for `/api/debug`.
- `src/debug/debugClientConfig.ts` — client-side knobs (label, showReasons, …).
- `src/components/DebugButton.tsx` — the button (mirrors `RunButton`).
- `docs/DEBUG_FEATURE.md` — this file.

**Changed**
- `pages/[id].tsx` — `handleDebugCode`, button wiring, clear highlights on Run.
- `src/components/NavBar/NavBar.tsx` — optional `debugButton` slot next to Run.
- `src/components/editor/editor-types.ts` — `setBugHighlights`/`clearBugHighlights` on `AlgoProMonacoEditor`.
- `src/components/editor/MonacoEditor/editorEnhancements.ts` — the decoration implementation.
- `src/styles/globals.css` — `.debug-bug-highlight` and `.debug-bug-glyph`.
- `Dockerfile` — `npm install -g @anthropic-ai/claude-code` in the `web` image.
- `docker-compose.yml` — pass `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CONFIG_DIR`, `DEBUG_CLAUDE_MODEL` to `web`.

## How the AI is invoked

- **Why the CLI and not the Anthropic API?** The available credential is a
  Claude Code OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`), which is **not** an API
  key — it only works through the `claude` binary. So the binary is baked into
  the `web` image and invoked as a subprocess.
- **Single-shot, no tools.** The prompt is fully self-contained, and all tools
  are disabled (`--disallowed-tools`), so Claude answers in one turn (~5 s) and
  never touches the filesystem/network inside the container.
- **Line-numbered code.** The code is sent with `N | ` prefixes and the model is
  told to report those exact numbers. This is the single biggest accuracy win
  for getting correct line references.
- **Strict JSON contract** (enforced via `--append-system-prompt`):
  `{"buggyLines":[{"line":<int>,"reason":"<short>"}],"summary":"<short>"}`.
  The server tolerates fenced/dirty output and validates line numbers against
  the actual line count.
- **Distinct failure modes.** `claude-unavailable` (spawn failed),
  `claude-timeout`, `claude-failed` (non-zero exit), `unparseable-envelope`,
  `model-error`, `unparseable-findings` are never collapsed together — a
  pipeline failure is always distinguishable from "the model found nothing".

## Logging (so AI calls can be debugged)

Every `/api/debug` AI call is logged as **one structured `[ai-debug] …` JSON line
to the server console** — `console.log` on success, `console.error` on failure —
so it shows up in the normal log stream (`docker compose logs web`, or whatever
collects the platform's logs). No files, no volumes: `logDebugCall()` in
`pages/api/debug.ts` just writes to stdout/stderr.

Each line carries enough to debug the call without dumping student code:
- **metadata** — `model`, `language`, `problemTitle`, `statementSource`
  (`inline` \| `pdf` \| `none`), `codeChars`/`statementChars`, `timeoutMs`,
  `durationMs`;
- **on success** — `findingsCount`, `findingLines`, `summaryChars`, and `usage`
  (tokens + `costUsd`);
- **on failure** — `error` + `detail`, plus the capped raw artefact for that mode
  (`stdout`/`stderr`/`exitCode` or `resultText`) so the cause is reconstructable.

Grep the logs for `[ai-debug]`; pipe a line through `jq` if you want it expanded.
Logging is pure — it never touches the response.

## Customisation knobs

### Server (env vars, set in `docker-compose.yml` → `web.environment`)
| Variable | Default | Meaning |
| --- | --- | --- |
| `DEBUG_CLAUDE_MODEL` | `sonnet` | Model alias/id (`opus`, `haiku`, full id, …). |
| `DEBUG_CLAUDE_BIN` | `claude` | Path/name of the CLI binary. |
| `DEBUG_CLAUDE_TIMEOUT_MS` | `90000` | Hard timeout for one analysis. |
| `DEBUG_OUTPUT_LANGUAGE` | `Hungarian` | Language the AI writes `reason` + `summary` in (instructions stay English). |
| `DEBUG_MAX_CODE_CHARS` | `60000` | Truncate very large code pastes. |
| `DEBUG_MAX_STATEMENT_CHARS` | `20000` | Truncate very large statements. |
| `DEBUG_DISALLOWED_TOOLS` | `Bash,Read,…` | Tools to deny to the model. |
| `CLAUDE_CODE_OAUTH_TOKEN` | — | **Required.** Substituted from the host shell at `up` time. |
| `CLAUDE_CONFIG_DIR` | `/tmp/claude-config` | Writable config dir for the CLI in-container. |
| `DEBUG_LOG_MAX_FIELD_CHARS` | `4000` | Cap on each long diagnostic field in a log line (failure artefacts). |

The **prompt / JSON contract** itself lives in `SYSTEM_PROMPT` and
`buildUserPrompt()` in `pages/api/debug.ts` — edit there to change what the AI is
asked to do (e.g. "also flag style issues", "only logic bugs", a different
output schema).

### Client (`src/debug/debugClientConfig.ts`)
| Field | Default | Meaning |
| --- | --- | --- |
| `buttonLabel` | `Debug` | Text on the button. |
| `showReasons` | `false` | `true` ⇒ show the AI's per-line reason as a hover tooltip. |
| `genericHoverMessage` | "AI flagged…" | Tooltip when `showReasons` is false. |
| `noIssuesMessage` | "The AI did not find…" | Alert when nothing is found. |

### Highlight appearance (`src/styles/globals.css`)
`.debug-bug-highlight` (line background) and `.debug-bug-glyph` (margin dot).
The overview-ruler colour is set in `editorEnhancements.ts`.

## Running / requirements

- The `web` image must be **rebuilt** after the Dockerfile change so the `claude`
  CLI is present: `docker compose up -d --build web`.
- `CLAUDE_CODE_OAUTH_TOKEN` must be exported in the shell that runs
  `docker compose up` (it is substituted into the container env). On this box it
  is exported from `/workspace/.claude/.bashrc`.
- The frontend (`pages/`, `src/`) hot-reloads; the API route hot-reloads too.
  Only Dockerfile/dependency changes need a rebuild.

## Known limitations / future work

- **Mobile / CodeMirror.** Highlighting is implemented for the Monaco (desktop)
  editor only. The button is shown on all viewports, but on the CodeMirror
  (mobile) editor the highlights are a no-op. Adding a CodeMirror decoration set
  is the natural follow-up.
- **Problem statement is sent as HTML.** It is truncated but not stripped; the
  model handles HTML fine, but a HTML→text pass would tighten the prompt.
- **No caching / rate-limiting.** Every click spawns a `claude` process. For a
  classroom, consider debouncing, a cache keyed on (code, problem), or a queue.
- **Auth/abuse.** The endpoint is unauthenticated and runs the AI on behalf of
  the server's token. Fine for local/dev; add auth + quotas before production.
