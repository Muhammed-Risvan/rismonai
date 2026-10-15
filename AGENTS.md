# Rismon — working agreement

This file is the contract between you (the human) and me (the AI agent).
Read the first two sections before asking me for anything.

---

## 1. Who runs what

This is the most important section. Two kinds of commands exist and they must
never be blurred.

### 🔒 You run these. I must never run them.

| Command | Why it's yours |
| --- | --- |
| `git commit`, `git push`, `git tag` | Reviewing and committing your own work is your decision, not mine. |
| `pnpm db:migrate` | This changes your **real database**. It is not undoable by re-running a command. |
| Anything in the Supabase dashboard | Same reason. |
| Installing global software | Changes your machine. |

If you ask me to do one of these, I will still refuse and explain why. The
only exception is `git commit` **inside a `gh` pull-request flow**, which you
have not authorised.

### ✅ I run these freely, any time

```powershell
pnpm test          # unit tests (safe, no database)
pnpm typecheck     # TypeScript errors
pnpm lint          # code style
pnpm build         # production build
pnpm db:generate   # writes SQL under drizzle/ — does NOT touch the database
pnpm dev           # local dev server
git status         # git diff
```

These are all **read-only or local**. None of them can damage your data.

### 🤝 We both run these, but only you decide

| Command | What it really does |
| --- | --- |
| `pnpm install` | Installs packages. Only needed when `package.json` changes. |
| `pnpm test:db` | Runs database tests. It **creates and deletes throwaway test accounts** in your real Supabase project. Safe by design (it cleans up), but it touches real data. |

I will ask before running either.

---

## 2. The normal loop

When I finish a piece of work, I run these four and paste you the real output:

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

If I change `src/server/db/schema.ts`, I also run:

```powershell
pnpm db:generate
```

It must say **"No schema changes, nothing to migrate"**. If it proposes a new
migration file, I stop and explain rather than accepting it silently.

**I never claim something works unless I have run the command and seen it pass.**
If I can't verify it, I say so.

---

## 3. Changing the database

Migrations are the one irreversible thing in this project, so the rules are strict.

```powershell
pnpm db:generate   # I can run this — writes a .sql file, touches nothing
```

Then:

1. I write the SQL file.
2. **You read it.** It's plain text. Ask me to explain any line you don't understand.
3. **You run `pnpm db:migrate`** to apply it.

Two rules that must survive any future edit:
- Schema changes happen **only** through Drizzle migrations. Never by editing
  the database in the dashboard.
- Every migration that creates a table must also `ENABLE ROW LEVEL SECURITY`
  and `REVOKE ALL ... FROM anon, authenticated`, so Supabase's auto-generated
  API can never read or write learner data.

---

## 4. Secrets — the hard rule

- Never print, log, commit or paste the contents of `.env.local`, `.env`, or
  any real key or database dump.
- To check configuration, use `pnpm check:env`. It prints only variable **names**
  and `set` / `missing` — never values.

```powershell
pnpm check:env
```

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all row-level security. It may appear
  **only** in `tests/helpers/`. If I ever find it in `src/`, treat that as a
  critical bug.

---

## 5. Codebase rules (the engineering law)

These keep the app correct. Please don't ask me to break them for speed.

- **Layers are one-way:** UI/routes → services → data access → pure core.
- **Routes hold no business logic.** They validate input, get the learner id,
  call a service, shape the response.
- **The learner id comes only from the verified session** — never from a
  request body, query string, or header. Every service function takes
  `learnerId` as its first argument.
- **The frontend never decides mastery.** It renders what the engine returns.
- **Mastery, planner and revision logic live only in pure modules** under
  `src/core`, with tests. They never call the clock, network, or database —
  the current time is passed in as an argument.
- **AI proposes; deterministic code decides.** AI output is validated and can
  never set mastery or override an answer key.
- Keep changes small and reviewable. Don't rewrite unrelated files.
- Add or update tests for all learning logic.
- Use PowerShell-compatible commands (Windows).
- Ask instead of guessing when something is unclear.
- Don't implement features outside the current milestone.

---

## 6. Git

- `git status` and `git diff` are always fine.
- Committing, pushing, tagging, deploying, stashing and discarding are yours.
- There are currently **~83 uncommitted changes** in this working tree from our
  milestone work. Do not discard them. Review with
  `git diff` and `git status` before your first commit.

---

## 7. If something breaks

| Symptom | What it usually means |
| --- | --- |
| `pnpm test` red | Read the failure output. Paste it to me. Often a test asserting old behaviour. |
| `pnpm db:generate` proposes a file | The schema and the last snapshot disagree. Tell me — I investigate before regenerating. |
| `pnpm db:migrate` errors | **Stop.** Paste the error. Do not edit the SQL by hand to force it through. |
| `pnpm dev` won't start | Usually a missing env var. Run `pnpm check:env`. |
| Test says `column "x" does not exist` | A migration hasn't been applied yet. That's your `pnpm db:migrate` step. |

**The golden rule:** when something breaks, read the actual error and paste it
to me. Don't guess, don't retry blindly, and never "fix" it by editing the
database directly.

---

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->