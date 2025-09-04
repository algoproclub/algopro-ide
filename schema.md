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
    - `id`: same as doc id
    - `platform`: same as parent doc id
    - `title`: string
    - `url`: string
    - `source`: ??
    - `statement`: string
    - `submittable`: boolean
    - `memoryLimit`: string
    - `input`: string?? (stdin)
    - `output`: string?? (stdout)
    - `hints`: ?[]
    - `samples`: ?[]
    - `tags`: ?[]

- `userdata/*`:
  - id format: random id
  - fields:
    - `schools`: `string[]` - list of schools the user is in
    - `groups`: `string[]` - list of groups the user is in
    - `user_full_name`: `string` - user's display name in the group editor and the `/teacher` page
    - other fields used only by the discord bot can found in the [Discord Bot repo](https://github.com/algoproclub/algopro-bot/blob/main/wiki/database.md#userdata-schema)

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
