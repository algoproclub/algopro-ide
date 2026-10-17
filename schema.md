# Firestore document schema:

- `schools/*`:

  - id format: custom string chosen by admins
  - fields:
    - `name`: `string` - The display name of the group

- `groups/*`:

  - id format: custom string chosen by school teachers, prefixed with `${school}~`
  - fields:
    - `school`: `string` - The ID of the school that the group belongs to

- `groups/*/classes/*`:

  - id format: custom string chosen by teachers
  - fields:
    - `creationTime`: `number` - UNIX timestamp, usually used when sorting
    - `tasks`: `Task[]`
      - `type Task = { id: string, platform: string, title: string, url: string }`

- `problemsets/*/problems/*`:

  - id format: upstream id format
  - fields:
    - `id`: `string` - same as doc id
    - `platform`: `string` - same as parent doc id
    - `title`: `string`
    - `url`: `string`
    - `source`: `string` - platform + id nicely formatted
    - `statement`: `string`
    - `submittable`: `boolean`
    - `memoryLimit`: `string`
    - `input`: `string??` (stdin)
    - `output`: `string??` (stdout)
    - `hints`: `?[]`
    - `samples`: `?[]`
    - `tags`: `?[]`

- `userdata/*`:
  - id format: random id
  - fields:
    - `schools`: `string[]` - list of schools the user is in
    - `groups`: `string[]` - list of groups the user is in
    - `user_full_name`: `string` - user's display name in the group editor and the `/teacher` page
    - other fields used only by the discord bot can found in the [Discord Bot repo](https://github.com/algoproclub/algopro-bot/blob/main/wiki/database.md#userdata-schema).
      The `/user/[id]` page also displays `student_email`, `first_seen`, `atcoder_handle`, `codeforces_handle`,
      `user_discord_id` and `user_discord_name` when the discord bot has written them.

## Only used by the discord bot:

- `aggregated-presence/*`:
  - See [Discord Bot repo](https://github.com/algoproclub/algopro-bot/blob/main/wiki/database.md#aggregated-presence-schema)
- `aggregated-presence/*/users/*`:
  - See [Discord Bot repo](https://github.com/algoproclub/algopro-bot/blob/main/wiki/database.md#aggregated-presence-schema)
- `presence/*`:
  - See [Discord Bot repo](https://github.com/algoproclub/algopro-bot/blob/main/wiki/database.md#presence-schema)

### Only used by discord bot testing

Collections that start with `dev-` are not used during production.
They are only used during Discord Bot development

# Realtime Database schema:

Source code is not stored here. `files/*` holds workspace metadata and runtime
state, while the document text lives in the Hocuspocus/Yjs service.

- `users/*`:

  - id format: Firebase Authentication UID, the same id as the `userdata/*` document
  - `data`: editor and account settings, loaded into `UserData` in [src/context/UserContext.tsx](src/context/UserContext.tsx)
    - `defaultLanguage`, `defaultPermission`, `editorMode`, `tabSize`, `fontSize`, `lightMode`,
      `rainbowIndent`, `manualSubmission`, `templateCode`, `name`
    - `usernames`: `Partial<Record<Platform, string>>` - judge handles used when submitting
    - `discordID`: `string` - duplicated; `userdata/*.user_discord_id` is authoritative
  - `files/*`: per-user index of recently opened workspaces, written by
    [src/hooks/useUpdateUserDashboard.ts](src/hooks/useUpdateUserDashboard.ts) and removed again when the
    user's permission becomes `PRIVATE`. Indexed on `lastAccessTime`.
    - id format: the `files/*` id
    - fields: `title`, `lastAccessTime`, `creationTime`, `lastPermission`,
      `lastDefaultPermission`, `hidden`, `version`, and `owner: { id, name }` since version 2
    - The index covers every workspace the user opened, not only their own. Select owned
      workspaces by `owner.id`, falling back to `lastPermission === 'OWNER'` for version 1 entries.
  - `platform-${platform}`: one node per `Platform` in [src/types/problem.ts](src/types/problem.ts)
    - `problem-id-to-file-id/*`: problem id -> `files/*` id, claimed transactionally by
      [pages/api/createNewPlatformFile.ts](pages/api/createNewPlatformFile.ts) so concurrent opens share one workspace
    - `solved/*`: problem id -> `true`, denormalized by the Cloud Function that records an accepted verdict
  - `tournaments/tournament-id-to-file-id/*`: tournament id -> `files/*` id

- `files/*`:

  - id format: push id (starts with `-`); the `/[id]` route drops the leading `-`
  - fields: see `FileData` in [src/context/EditorContext.tsx](src/context/EditorContext.tsx)
  - `settings`: `workspaceName`, `language`, `compilerOptions`, `defaultPermission`, `creationTime`, `classroomID`
  - `users/*`: user id -> `{ name, color, permission, connections }`; exactly one has `permission: 'OWNER'`
  - `problem`: `{ platform, id }` for platform workspaces, `null` otherwise. Older records may hold a full `ProblemData`.
  - `teacher`: `{ editTime, codeSize }` - denormalized projection the `/teacher` and `/recent` pages read
    instead of the document itself. Indexed on `teacher/editTime`.
  - `state`, `chat`, `codeRun`, `input`, `solvedStatus`, `submission`, `classroom`, `tournamentID`

- `submissions/*`:
  - id format: the `files/*` id, except `submissions/pending`, which tracks judge polling
  - `statusData`: `StatusData` in [src/types/problem.ts](src/types/problem.ts) - the latest verdict
  - `statusDataHistory`: array of past `statusData` values, each with a `submissionTime`
