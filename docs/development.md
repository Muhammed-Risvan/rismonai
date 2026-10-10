# Development workflow

## One milestone at a time

- Work strictly inside the current milestone's scope. When it is done and verified, stop; the human decides when the next milestone starts.
- Do not implement features outside the current milestone.

## Commits are made by the human

- AI agents and contributors **never** run `git commit`, `git push`, `git tag` or release/deploy commands. The human reviews and commits.
- `git status` and `git diff` are always allowed.

## Reviewing a diff

```powershell
git status
git diff            # unstaged changes
git diff --staged   # staged changes
```

Read every changed file before committing. Confirm that no secrets, `.env` files, logs or database dumps are included.

## Running checks

```powershell
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- Report the **real** terminal output. Never claim a check passed without running it and seeing it pass.
- For long output, redirect to a file, read the file, then delete it — `*.log` is gitignored, e.g.:

```powershell
pnpm build > build.log 2>&1
Get-Content build.log
Remove-Item build.log
```

## Environment rules

- Use **PowerShell-compatible** commands (Windows).
- `.env.example` lists variable names with safe placeholders; real values go in `.env.local`, which is never committed, printed or logged.
- The Node major version is pinned by `engines` in `package.json` and `.nvmrc`; the package manager version by `packageManager`.
- Schema changes happen only through Drizzle migrations, reviewed by the human before they are applied — never by editing the database through the dashboard.

## Database migration workflow

```powershell
pnpm db:generate   # writes SQL under drizzle/ — safe to run any time
# ...human reviews the SQL...
pnpm db:migrate    # applies it — ONLY after the human says "migration applied"
```

- `drizzle.config.ts` reads `DATABASE_MIGRATION_URL` from `.env.local`
  (drizzle-kit only; never the app's `DATABASE_URL`).
- `pnpm check:env` prints each variable NAME and `set`/`missing` — never
  values. `.env.local` and real env files must never be opened, read or
  printed by anyone but the human.
- DB integration tests run only when `ALLOW_DB_TESTS=true`; they live in
  `tests/` and use `tests/helpers/` (the only place the service-role key
  may appear).

## Asking

Ask instead of guessing when something is unclear.
