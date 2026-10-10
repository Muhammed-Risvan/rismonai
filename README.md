# Rismon

Rismon is a hosted, multi-user AI learning tutor (deployed on Vercel at [rismon.ai](https://rismon.ai)) that helps learners master any subject through personalized lessons, practice and spaced revision — where deterministic code, not the AI, validates every answer and owns the learner's mastery state.

## Prerequisites

- **Node.js 24 LTS** (major pinned by `engines` in `package.json`; exact version in `.nvmrc`)
- **pnpm** (version pinned by `packageManager` in `package.json` — install with `corepack enable pnpm`, or `npm install -g pnpm`)
- **Git**

All commands are for **PowerShell** and are run from the repository root.

## Install

```powershell
pnpm install
```

## Run (development)

```powershell
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at `http://localhost:3000/api/health`:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Stop the dev server with `Ctrl+C`.

## Test

```powershell
pnpm test
```

## Type check

```powershell
pnpm typecheck
```

## Build

```powershell
pnpm build
```

Start the production server with `pnpm start` after building.

## Lint

```powershell
pnpm lint
```

## Environment variables

`.env.example` lists the variable names that future milestones will use. **None of them are used yet.** Real values belong in `.env.local`, which is never committed — `.env*` is gitignored except for `.env.example`.

## Documentation

- `docs/architecture.md` — stack and layer rules
- `docs/development.md` — development workflow
- `AGENTS.md` — rules for AI agents working in this repository
