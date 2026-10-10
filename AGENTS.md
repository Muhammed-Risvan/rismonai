# Rules for agents

- Do not run `git commit`, `git push`, `git tag` or release commands. The human does these.
- Never commit, print or log secrets, `.env` files or database dumps.
- Keep changes small and reviewable; do not rewrite unrelated files.
- Do not add frameworks, services or dependencies without justification.
- Read `docs/architecture.md` before implementing a feature.
- Routes contain no business logic; services are scoped by `learnerId`; the learner identity comes only from the verified session.
- The frontend never decides or computes mastery.
- AI output is validated and can never set mastery or override answer keys.
- Mastery, planner and revision logic live only in pure core modules with tests; they never call the clock, network or database directly.
- Schema changes only through Drizzle migrations that the human reviews before they are applied; never edit the schema through the dashboard.
- Add or update tests for all learning logic.
- Run the relevant checks and report real output; never claim something works without running it.
- Use PowerShell-compatible commands.
- Ask instead of guessing when something is unclear.
- Do not implement features outside the current milestone.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
