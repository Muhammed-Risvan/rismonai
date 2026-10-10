# Database

PostgreSQL via Supabase. All app access goes through Drizzle over a direct
connection — never through Supabase's auto-generated Data API.

## Tables

### `learner_profiles`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key, **no default** — equals `auth.users.id` (FK added in the migration, `ON DELETE CASCADE`) |
| `display_name` | text | nullable, `length <= 80` (check) |
| `timezone` | text | not null, default `'UTC'` |
| `created_at` | timestamptz | not null, default `now()` |
| `updated_at` | timestamptz | not null, default `now()` (set to `now()` on updates) |

### `goals`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key, default `gen_random_uuid()` |
| `learner_id` | uuid | not null, FK → `learner_profiles(id)` `ON DELETE CASCADE`, indexed |
| `title` | text | not null, `length between 1 and 200` (check) |
| `description` | text | nullable, `length <= 2000` (check) |
| `target_outcome` | text | nullable, `length <= 500` (check) |
| `status` | text | not null, `in ('active','paused','archived','completed')` (check) |
| `deadline` | date | nullable |
| `hours_per_week` | integer | nullable, `between 1 and 80` (check) |
| `created_at` / `updated_at` | timestamptz | not null, default `now()` |

**Partial unique index** `goals_one_active_per_learner`:
`CREATE UNIQUE INDEX ... ON goals (learner_id) WHERE status = 'active'` —
the **database** guarantees at most one active goal per learner, no matter
what the application does.

### Security (in the migration SQL)

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on both tables with **no policies**
  — by default nothing is allowed.
- `REVOKE ALL ON ... FROM anon, authenticated` — even if a policy were added
  later, the API roles have no table privileges.
- Result: Supabase's auto-generated Data API cannot read or write
  `learner_profiles` / `goals` for anyone. Learner data only moves through
  the server-side Drizzle connection (see `docs/architecture.md`).

## Connection strings (two of them, on purpose)

| Variable | Port / pooler | Used by | Why |
| --- | --- | --- | --- |
| `DATABASE_URL` | **6543** transaction pooler on Vercel; session pooler locally is OK | the app at runtime | Transaction pooling suits short serverless queries; the client runs with `prepare: false` (required) and `max: 1` |
| `DATABASE_MIGRATION_URL` | **5432** session pooler | `drizzle-kit` only (`drizzle.config.ts`) | Migrations need session features (prepared statements, transactions, `ALTER TABLE`); the transaction pooler would break them |

`SUPABASE_SERVICE_ROLE_KEY` is only for test helpers (`tests/helpers/`);
app code never uses it. Check which names are set (never their values) with
`pnpm check:env`.

## Migration workflow

1. Edit `src/server/db/schema.ts`.
2. `pnpm db:generate` — writes a new SQL file under `drizzle/`.
3. Review the generated SQL (hand-edit only when Drizzle cannot express
   something, e.g. the `auth.users` foreign key, RLS and revokes — keep the
   file reproducible).
4. **The human reviews, then applies** with `pnpm db:migrate`.
5. **Never edit the schema in the Supabase dashboard** — schema changes only
   go through reviewed Drizzle migrations.

Connection credentials for drizzle-kit come from `.env.local`
(`DATABASE_MIGRATION_URL`); values are never printed or committed.
