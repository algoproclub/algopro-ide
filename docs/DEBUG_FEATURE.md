# AI "Debug" feature

A **Debug** button next to **Run Code** sends the student's current code and the
problem statement to an AI (Anthropic models via the OpenRouter API) and **highlights the
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
                              ├─ POST https://openrouter.ai/api/v1/chat/completions
                              │   (system prompt = JSON contract, user prompt = problem+code;
                              │    OPENROUTER_API_KEY from env; model default `sonnet`)
                              └─ parse reply → extract {buggyLines:[{line,reason}], summary}
                                                                              │
  setBugHighlights(lines)  ◄───────────────────────────────────────────────┘
  editorEnhancements.ts → Monaco decorations collection (class `debug-bug-highlight`)
```

## Files

**Added**
- `pages/api/debug.ts` — the backend endpoint; calls the OpenRouter API.
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
- `docker-compose.yml` — pass `OPENROUTER_API_KEY` and `DEBUG_MODEL` to `web`.

## How the AI is invoked

- **Direct API, no CLI.** The analysis is a single-turn prompt→JSON call, so it
  goes straight to a provider API (default: OpenRouter chat-completions with
  `anthropic/claude-sonnet-5`). Compared to the earlier `claude` CLI approach
  this removes the binary from the image, cuts per-call latency (no process
  spawn) and cost (no agent system-prompt overhead), and swaps the
  subscription OAuth token for a proper metered API key.
- **Swappable provider.** `DEBUG_PROVIDER=openrouter|anthropic|openai` (or,
  unset, the first of those with an API key configured). OpenRouter and OpenAI
  use the OpenAI chat-completions wire format; Anthropic uses its native
  Messages API. The `sonnet`/`opus`/`haiku` tier aliases map per provider
  (Anthropic: `claude-sonnet-5`/`claude-opus-4-8`/`claude-haiku-4-5`; OpenAI:
  `gpt-5.1`/`gpt-5.1`/`gpt-5-mini`); a full provider-specific model id in
  `DEBUG_MODEL` (or the per-request `model` override) passes through verbatim.
  Note: `usage.costUsd` is reported by OpenRouter only — 0 elsewhere means
  "not reported", not free.
- **Single-shot.** The prompt is fully self-contained; the model answers in one
  turn (~3–10 s) and nothing runs inside the container beyond one HTTPS call.
- **Line-numbered code.** The code is sent with `N | ` prefixes and the model is
  told to report those exact numbers. This is the single biggest accuracy win
  for getting correct line references.
- **Strict JSON contract** (enforced via the system prompt):
  `{"buggyLines":[{"line":<int>,"reason":"<short>"}],"summary":"<short>"}`.
  The server tolerates fenced/dirty output and validates line numbers against
  the actual line count.
- **Distinct failure modes.** `model-unavailable` (network/key), `model-timeout`,
  `model-failed` (HTTP error from OpenRouter), `model-error` (malformed/empty
  API reply), `unparseable-findings` are never collapsed together — a pipeline
  failure is always distinguishable from "the model found nothing".

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
| `DEBUG_MODEL` | `sonnet` | Model alias (`sonnet`/`opus`/`haiku`) or a full OpenRouter slug. Legacy `DEBUG_CLAUDE_MODEL` still read. |
| `DEBUG_TIMEOUT_MS` | `90000` | Hard timeout for one analysis. Legacy `DEBUG_CLAUDE_TIMEOUT_MS` still read. |
| `DEBUG_MAX_OUTPUT_TOKENS` | `4096` | Cap on the model's reply size. |
| `DEBUG_OUTPUT_LANGUAGE` | `Hungarian` | Language the AI writes `reason` + `summary` in (instructions stay English). |
| `DEBUG_MAX_CODE_CHARS` | `60000` | Truncate very large code pastes. |
| `DEBUG_MAX_STATEMENT_CHARS` | `20000` | Truncate very large statements. |
| `DEBUG_PROVIDER` | *(auto)* | `openrouter` \| `anthropic` \| `openai`; unset = first provider with a key. |
| `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | — | At least one **required**; substituted from the host shell at `up` time. |
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

- `OPENROUTER_API_KEY` must be exported in the shell that runs
  `docker compose up` (it is substituted into the container env). On this box it
  is exported from `/workspace/.claude/.bashrc`. For the functions emulator the
  same key lives in `functions/.env.local` (gitignored).
- The frontend (`pages/`, `src/`) hot-reloads; the API route hot-reloads too.
  Only Dockerfile/dependency changes need a rebuild.

## Known limitations / future work

- **Mobile / CodeMirror.** Highlighting is implemented for the Monaco (desktop)
  editor only. The button is shown on all viewports, but on the CodeMirror
  (mobile) editor the highlights are a no-op. Adding a CodeMirror decoration set
  is the natural follow-up.
- **Problem statement is sent as HTML.** It is truncated but not stripped; the
  model handles HTML fine, but a HTML→text pass would tighten the prompt.
- **No caching / rate-limiting.** Every click is one paid API call. For a
  classroom, consider debouncing, a cache keyed on (code, problem), or a queue.
- **Auth/abuse.** Both endpoints require a signed-in user with the `registered`
  claim; there is no per-user quota yet — add one before wide production use.
