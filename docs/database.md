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
| `ambition_id` | text | nullable, FK → `ambitions(id)` `ON DELETE SET NULL` (added in migration 0001) |
| `created_at` / `updated_at` | timestamptz | not null, default `now()` |

**Partial unique index** `goals_one_active_per_learner`:
`CREATE UNIQUE INDEX ... ON goals (learner_id) WHERE status = 'active'` —
the **database** guarantees at most one active goal per learner, no matter
what the application does.

### `ambitions` (catalog)

| Column | Type | Rules |
| --- | --- | --- |
| `id` | text | primary key (slug), seeded from `content/` |
| `name` | text | not null, `length <= 120` (check) |
| `description` | text | not null, `length <= 1000` (check) |
| `target_outcome` | text | not null, `length <= 1000` (check) |
| `level` | text | not null, `in ('beginner','intermediate','advanced')` (check) |
| `created_at` / `updated_at` | timestamptz | not null, default `now()` |

Reference data, identical for every learner, so it is deliberately **not**
learner-scoped. Seeded lazily by `listAmbitions()` (idempotent upsert by slug),
so a fresh database can never render an empty ambition picker.

### `diagnostic_runs`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key, default `gen_random_uuid()` |
| `learner_id` | uuid | not null, FK → `learner_profiles(id)` `ON DELETE CASCADE`, indexed |
| `goal_id` | uuid | nullable, FK → `goals(id)` `ON DELETE SET NULL` |
| `ambition_id` | text | not null, FK → `ambitions(id)` `ON DELETE RESTRICT` |
| `content_version` | text | not null, semver pattern (check) |
| `item_ids` | text[] | not null |
| `items_snapshot` | jsonb | not null — the **frozen** item set: prompts, accepted answers, misconception signatures, order, conditional triggers |
| `required_capability_ids` | text[] | not null |
| `status` | text | not null, `in ('in_progress','complete','opted_out')` (check) |
| `created_at` / `updated_at` | timestamptz | not null, default `now()` |
| `completed_at` | timestamptz | nullable |

**Partial unique index** `diagnostic_runs_one_in_progress_per_learner_ambition`:
`... ON diagnostic_runs (learner_id, ambition_id) WHERE status = 'in_progress'`.
Also `UNIQUE (id, learner_id)`, used as the target of the composite foreign
key on `diagnostic_responses`.

### `diagnostic_responses` — the evidence ledger

One row per answered item per run. **First-answer-wins**: `UNIQUE (run_id,
item_id)` plus insert-or-select means duplicate submits return the canonical
row and correctness is never mutated.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key |
| `run_id` | uuid | not null, FK → `diagnostic_runs(id)` `ON DELETE CASCADE`, indexed |
| `learner_id` | uuid | not null, FK → `learner_profiles(id)` `ON DELETE CASCADE`, indexed |
| `item_id` | text | not null, `length between 1 and 120` (check) |
| `capability_id` | text | not null, copied from the frozen snapshot (audit-stable) |
| `response` | text | not null, `length between 1 and 500` (check) |
| `correct` | boolean | not null |
| `mode` | text | not null default `'independent'`, `in ('guided','independent')` (check) |
| `hints_used` | integer | not null default `0`, `>= 0` (check) |
| `misconception_id` | text | nullable; **`NULL` or `correct = false`** (check) — a misconception is the *reason* an answer was wrong, never something attached to a right one |
| `created_at` | timestamptz | not null, default `now()` |

**Composite foreign key** `(run_id, learner_id)` → `diagnostic_runs (id,
learner_id)`, hand-written because Drizzle cannot express composite FKs. This
is what makes a cross-learner response insert fail at the database, not just
in the service layer.

### `learner_capabilities`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key |
| `learner_id` | uuid | not null, FK → `learner_profiles(id)` `ON DELETE CASCADE`, indexed |
| `capability_id` | text | not null, `length between 1 and 120` (check); unique per learner |
| `level` | text | not null, `in ('unknown','untested','introduced','practising','demonstrated','mastered','revision-needed')` (check) |
| `source` | text | not null, `in ('diagnostic','opt-out')` (check) |
| `run_id` | uuid | nullable, FK → `diagnostic_runs(id)` `ON DELETE SET NULL` (provenance) |
| `evidence_count` | integer | not null default `0`, `>= 0` (check) |
| `assisted_pass` | boolean | not null default `false` |
| `last_demonstrated_at` | timestamptz | nullable |
| `review_at` | timestamptz | nullable — when the pure scheduler next wants this capability |
| `created_at` / `updated_at` | timestamptz | not null, default `now()` |

**Check `learner_capabilities_mastered_requires_evidence`**: a row may not
claim `mastered` with `evidence_count = 0`. This is the database-level version
of "no displayed mastery without a recorded passed assessment" — a displayed
level always carries its receipts.

**Partial index** `learner_capabilities_review_due_idx` on
`(learner_id, review_at) WHERE review_at IS NOT NULL` — the revision queue.

### `learner_misconceptions` — "remember the mistake"

The learner's exposure to an authored misconception. The description and
remediation themselves live in versioned `content/`, so content can be
corrected without rewriting learner history.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | uuid | primary key |
| `learner_id` | uuid | not null, FK → `learner_profiles(id)` `ON DELETE CASCADE`, indexed |
| `capability_id` | text | not null, `length between 1 and 120` (check) |
| `misconception_id` | text | not null, `length between 1 and 120` (check); unique per learner |
| `last_item_id` | text | not null — the item that most recently evidenced it |
| `times_encountered` | integer | not null default `1`, `>= 1` (check) |
| `first_seen_at` / `last_seen_at` | timestamptz | not null, default `now()` |
| `resolved_at` | timestamptz | nullable — set only when the learner later passes the related item unassisted |
| `created_at` / `updated_at` | timestamptz | not null, default `now()` |

**Partial index** `learner_misconceptions_open_idx` on
`(learner_id, capability_id) WHERE resolved_at IS NULL` — the revision queue.

### Security (in the migration SQL)

Applied to **every** table in every migration:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with **no policies** — by default
  nothing is allowed.
- `REVOKE ALL ON ... FROM anon, authenticated` — even if a policy were added
  later, the API roles have no table privileges.
- Result: Supabase's auto-generated Data API cannot read or write any learner
  table for anyone. Learner data only moves through the server-side Drizzle
  connection (see `docs/architecture.md`).

**Known gap:** the protection is per-table and hand-written into each migration,
so a *future* table is unprotected until someone remembers to add these two
lines. There is also no `FORCE ROW LEVEL SECURITY`, because the app connection
runs as the table owner and would otherwise be blocked — the defence rests on
service-layer `learnerId` scoping, the revokes, and the connection string
never leaking.

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
