# Contributing to Evidentia

Several people, and their AI coding agents, work on this repo at once. [AGENTS.md](AGENTS.md) has the full rules for working in parallel; this is the short version. [docs/PLAN.md](docs/PLAN.md) is the source of truth for the architecture, the API contract and which track owns which folders.

## Set up

Follow "Run it" in the [README](README.md). Run `python -m app.seed --reset` whenever you want the demo data back.

## Make a change

1. Branch from the latest `main`, named by milestone and track: `git switch -c m4/scene-annotations origin/main`. Never commit to `main`.
2. Check open pull requests and remote branches first, so you don't duplicate someone's work.
3. Stay inside the folders your task needs. Don't reformat, rename or upgrade what your task doesn't touch.
4. Change API types in the FastAPI schemas first, then run `npm run gen:api` in `frontend/` with the backend running.
5. Before adding an Alembic migration, merge `main` so it builds on the current head.
6. Use npm only. If `package-lock.json` conflicts, regenerate it with `npm install`.

## Before you open a pull request

```sh
git fetch origin && git merge origin/main
cd backend && pytest
cd frontend && npm run lint && npm run build
```

Open a draft pull request into `main` that says what changed, why, and how to test it, and lists any shared files you changed: `package.json`, `package-lock.json`, `pyproject.toml`, `.env.example`, the FastAPI schemas or migrations.

## Never commit

`.env`, `storage/`, API keys, `node_modules/`, build output or raw Blender files. Commit optimised GLB exports under 100 MB.

## Evidence and AI output

Demo and test data must be invented. Never commit real case files, statements, medical records or personal data. AI output in the app is a proposal with its source passage: keep it reviewable, and don't add features that state guilt.
