# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI and others) working in this repo. They put the "Team and git workflow" section of [docs/PLAN.md](docs/PLAN.md) into practice, and apply to humans too.

## The project

Forensix is an AI forensic investigation platform built for Hackinverse. [docs/PLAN.md](docs/PLAN.md) is the source of truth for the architecture, API contract, directory layout, milestones and which track owns which folders. Read the sections that cover your task before you change anything.

## Working in parallel

Several people work on this repo at the same time, and each may run several AI sessions at once. Assume other branches are changing the code while you work.

1. **Never commit or push to `main`.** Changes reach `main` only through pull requests that a human merges.
2. **Use one branch per task, created from the latest `main`:**
   ```sh
   git fetch origin
   git switch -c m1/backend-case-api origin/main
   ```
   Name branches by milestone and track, as in the plan: `m1/backend-case-api`, `m4/3d-scene-loader`. If your tool has already assigned you a branch, use that one. Check `git branch -r` first so you don't reuse a branch someone else is working on.
3. **Check for overlapping work before you start.** Look at open pull requests and remote branches. If another branch is already doing your task or editing the same files, stop and ask before going further.
4. **Stay inside your task.** Work in the folders your track owns (see the plan). Don't reformat, rename, move or "clean up" code your task doesn't need, and don't upgrade dependencies unless asked.
5. **Keep changes to shared files small, and list them in the PR.** Shared files include `package.json`, `package-lock.json`, `pyproject.toml`, `.env.example`, the FastAPI schemas and Alembic migrations.
   - Change API types in the FastAPI schemas first, then run `npm run gen:api`.
   - Use npm only. If `package-lock.json` conflicts, regenerate it with `npm install`; don't edit it by hand.
   - Before adding an Alembic migration, merge `main` so it builds on the current head. Two branches that each add a migration from the same parent leave Alembic with two heads.
6. **Commit small and often, and push your branch** so other people can see what's in progress.
7. **Before opening a pull request, merge the latest `main` into your branch** (`git fetch origin && git merge origin/main`). When resolving conflicts, keep the other side's work. If you can't tell which version is right, stop and ask. Then run the checks that exist: `npm run lint` and `npm run build` in `frontend/`, and `pytest` in `backend/`.
8. **Open a draft pull request into `main`.** Say what changed, why and how to test it, and link the issue (`Closes #12`). Don't merge it. Humans merge at the checkpoints in the plan.
9. **Never rewrite shared history.** Don't force-push, rebase or delete a branch you didn't create, and never rewrite `main`.
10. **Never commit** `.env`, `storage/`, API keys, `node_modules/`, build output or raw Blender files. Commit optimized GLB exports under 100 MB.
11. **When you finish**, report the branch name, the PR link, a short summary and anything left undone.
