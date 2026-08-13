# CLAUDE.md — NosChatV3 Project Context & Session Protocol

> **This file is the single source of truth for project state.** Read this entire file before doing anything else in a session. It should always reflect reality — if it's out of date, that's a bug, fix it as part of your work.

---

## 0. How to Use This File (read this first, every session)

1. **On session start:** Read this whole file top to bottom before writing any code or making any changes. Do not ask the user "what were we working on" — it's answered in Section 3 (Current Status) and Section 4 (Next Steps).
2. **Check the spec:** `NosChatV3-Spec-v2.md` (in the project root) is the full product/architecture spec. This file is the *state tracker*; the spec is the *source of truth for what to build*. If they ever conflict, the spec wins on product decisions, this file wins on "what's actually been done so far."
   - **NOTE:** The spec file has still not actually been placed in this repo — only this CLAUDE.md was carried over from the planning session. Locate/re-attach `NosChatV3-Spec-v2.md` and add it to the repo root ASAP; until then, Section 1 below is the only architecture reference in-repo.
3. **During the session:** After completing any meaningful step (a feature, a fix, a config change, a decision made with the user, a blocker hit), update this file immediately — don't wait until the end of the session. Meaningful = anything the next session needs to know to not repeat work or re-ask a question.
4. **Update discipline:**
   - Update **Section 3 (Current Status)** so it always reflects the true current state.
   - Append a dated entry to **Section 6 (Session Log)** — never delete old entries, this is an append-only history.
   - Update **Section 4 (Next Steps)** so the next session (or the next step in this one) has a clear, concrete pickup point — not "continue working on backend," but the actual next action.
   - If a decision was made that changes or adds to the spec, note it in **Section 5 (Decisions & Deviations Log)** and reflect it in the actual spec file too.
5. **On session end (or when the user says they're stepping away):** Do one final pass over Sections 3 and 4 to make sure they're accurate, even if nothing "big" happened.
6. **Never mark something done in Section 3 unless it actually is** — verified working, not just written. If it's written but untested, say so explicitly.

---

## 1. Project Summary

**NosChatV3** — a Discord/Slack-style real-time communication, community, and social platform.

**Architecture (see full spec for detail):**
- Frontend: Next.js (React/TS), deployed to Vercel
- Backend: Rust + Axum, self-hosted in Docker on the user's homelab
- Database: PostgreSQL, self-hosted on homelab
- Cache/pub-sub: Redis/Valkey, self-hosted on homelab
- Search: OpenSearch, self-hosted on homelab
- File storage: MinIO, self-hosted on homelab
- Auth: fully self-hosted (no Clerk/Firebase/Auth0) — Argon2id + JWT + TOTP + WebAuthn
- Voice/video: WebRTC + self-hosted mediasoup SFU + coturn
- Push notifications: Web Push (VAPID), no Firebase
- Domain: custom domain connects Vercel frontend to homelab backend via reverse proxy (Caddy/Traefik) + Cloudflare Tunnel or DDNS

**Explicitly forbidden in this project:** Firebase (any service), Clerk, Auth0, Supabase, any managed cloud database, any managed object storage as the primary store. See Spec Section 24.6 for the full list.

**Full spec file:** `NosChatV3-Spec-v2.md` (not yet re-attached to this repo — see note in Section 0.2)

**Repo structure decision:** Monorepo — `frontend/` (Next.js) and `backend/` (Rust/Axum workspace) live side by side in this repo, confirmed with user.

---

## 2. Repo / Environment Facts

- **Repo location:** `NosChatV3/` (local git repo, branch `main` — see Section 3 for commit history)
- **Repo structure:** Monorepo — `frontend/`, `backend/`, `docker-compose.yml` at root
- **Repo remote:** none configured yet — repo exists only on this local machine
- **Homelab access:** not yet documented — note IP/hostname conventions, Docker host details, how to reach it once set up
- **Domain name in use:** not yet provided by user
- **Vercel project:** not yet created
- **Local dev — how to run:**
  - Frontend: `cd frontend && npm run dev` (Next.js dev server)
  - Backend: `cd backend && cargo run --bin auth-service` (binds `0.0.0.0:4000`, exposes `GET /health`)
  - Local DB/cache: `docker compose up -d` from repo root (Postgres on host port **5433**, Redis on 6379)
- **⚠️ IMPORTANT MACHINE-SPECIFIC QUIRK — dev Postgres runs on port 5433, NOT 5432:** This dev machine has a **pre-existing native Windows PostgreSQL service** (`postgres.exe`, unrelated to this project) already bound to port 5432. When our Docker Postgres container was also mapped to 5432, Windows silently routed connections to the *native* service instead of the container — with different credentials, this surfaced as a deeply misleading `password authentication failed for user "noschat"` error, even though the container itself was healthy and correct. **The container's Postgres logs showed zero connection attempts** during this failure — the confusing part — because the connections were never reaching the container at all. Diagnosed by running `netstat -ano | findstr :5432` and finding two PIDs bound to the port (one was `postgres.exe`). Fix: `docker-compose.yml` now maps the container to host port **5433** instead. `DATABASE_URL` fallback in `auth-service/src/main.rs` and `.env.example` both updated to match. **If a fresh session ever sees "password auth failed" against local Postgres again, check `netstat -ano | findstr :5432` for a port conflict before assuming the credentials are wrong.**
- **Local toolchain verified present:** Node v24.11.0, npm 11.17.0, rustc 1.94.0, cargo 1.94.0, Docker 29.6.2, git 2.51.2
- **Secrets / env vars:** `backend/auth-service/.env.example` documents the expected names (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`) with placeholder values only. No real `.env` created, nothing secret exists yet.

---

## 3. Current Status

**Phase:** Local dev environment fully scaffolded and verified end-to-end. No feature code (auth logic, DB schema, real UI) written yet.

**What exists and is VERIFIED working (actually run, not just written):**
- `frontend/` — Next.js 16 (App Router, TypeScript, Tailwind v4, ESLint), scaffolded via `create-next-app`, shadcn/ui initialized. `npm run build` succeeds cleanly. `next.config.ts` pins `turbopack.root` (fixes an unrelated root-detection warning caused by a stray `package-lock.json` in a parent directory outside the repo).
- `backend/` — Cargo workspace, one member `auth-service`. `cargo build` succeeds cleanly. Minimal Axum server binds `0.0.0.0:4000`, exposes `GET /health` → `{"status":"ok","service":"auth-service","db": <bool>}`. Does NOT crash if Postgres is unreachable at startup (logs a warning, still serves `/health` with `db:false`).
- `docker-compose.yml` — Postgres 16 (host port **5433**, see the quirk noted in Section 2) + Redis 7 (6379), local dev only. **Ran `docker compose up -d`, confirmed both containers report `healthy`/`Up`.**
- **Full end-to-end DB connectivity verified:** started `auth-service` with the real Postgres container up, curled `/health`, got `{"db":true,"service":"auth-service","status":"ok"}`. This is the first real proof the whole local chain (Rust app → sqlx → Docker Postgres) actually works. Also independently confirmed Postgres reachability with a throwaway Node.js `pg` test script (`node-postgres`) before touching the Rust side, to isolate whether an earlier failure was Rust/sqlx-specific or environmental — it was environmental (the port conflict), not a code bug.
- `.gitignore` — excludes `node_modules/`, `.next/`, `target/`, all `.env*` except `.env.example`.
- Git repo initialized, branch `main`, **three commits** — initial scaffold, a CLAUDE.md accuracy pass, and (pending, see below) this session's Postgres-port fix.

**What does NOT exist yet:**
- No repo remote (GitHub/GitLab/self-hosted Git/etc.) — repo is local-only. Worth asking the user which they want, given the project's "avoid third-party where possible" spirit — don't just default to GitHub without asking.
- No auth logic at all: no DB schema/migrations, no user table, no Argon2id password hashing, no JWT issuance/validation, no TOTP, no WebAuthn.
- No frontend auth pages, no layout beyond the default `create-next-app` boilerplate homepage.
- No homelab Docker stack, no domain/DNS/reverse proxy config, no Vercel project.
- `NosChatV3-Spec-v2.md` has **not been placed in the repo** — it was produced in the prior planning session but only this CLAUDE.md carried over. Section 1 above is a summary only, not a substitute for the real spec.
- Minor cosmetic note: `create-next-app` auto-generated `frontend/CLAUDE.md` (a one-line stub: `@AGENTS.md`) and `frontend/AGENTS.md`. Unrelated to this root `CLAUDE.md`, harmless — don't confuse the two.

**Active blockers:** None. The local dev stack (frontend build, backend build, Postgres, Redis, and the auth-service↔Postgres connection) is fully working and verified as of this session.

---

## 4. Next Steps (concrete pickup point)

1. **Locate and re-add `NosChatV3-Spec-v2.md`** to the repo root — it exists from the prior planning session but was never placed on disk here; ask the user for it if it can't be found elsewhere. Until it's in-repo, treat Section 1 above as the only architecture reference.
2. Design and write the first `sqlx` migration for `auth-service` — at minimum a `users` table (id, email, username, password_hash, created_at, etc.). Check the re-attached spec for the exact intended schema before inventing one. Remember local Postgres is on **port 5433**, not 5432 (see Section 2 quirk).
3. Implement real auth-service routes: `POST /register` (Argon2id hash + insert user), `POST /login` (verify password, issue JWT), wired to the real DB via `sqlx::query!` (compile-time checked — needs `DATABASE_URL` reachable at build time, or `cargo sqlx prepare` for offline builds).
4. On the frontend: build basic login/register pages (`frontend/src/app/(auth)/login`, `.../register`) that call the auth-service endpoints once they exist — Phase 1 MVP scope only, no real-time features yet.
5. Set up a remote for the repo — confirm with the user whether they want GitHub, GitLab, or self-hosted Git on the homelab before defaulting to anything.
6. Homelab Docker stack + domain/DNS/reverse proxy (Spec Section 24) comes after steps 1–5 are solid locally — don't jump ahead to this.

**Immediate next action if resuming right now:** Step 1 — get the real spec file into the repo, since schema and route design (steps 2–3) depend on it rather than a guessed-at schema.

---

## 5. Decisions & Deviations Log

*(Anything decided that adds to, changes, or deviates from the spec — so it's not lost or re-litigated. Most recent first.)*

- **Moved local dev Postgres from host port 5432 to 5433** in `docker-compose.yml` (and updated the matching `DATABASE_URL` defaults in `auth-service` and `.env.example`) because this specific dev machine has a pre-existing native Windows Postgres service already on 5432. This is a machine-specific workaround, not a spec-level decision — if this project is ever developed on a different machine without that conflict, 5432 would work fine, but 5433 is harmless either way so there's no need to revert it.
- Confirmed monorepo structure (frontend + backend in one repo) with user.
- Pivoted away from Flutter/Clerk/Firebase/Cloudflare R2 (original v1.0 spec) to Next.js/self-hosted-auth/MinIO, because the user's actual hosting plan (homelab backend+DB, Vercel frontend, custom domain, zero Firebase) required it. Full rationale in spec Section 24 and ADR log (spec file to be re-attached, see Section 0.2 note).

---

## 6. Session Log (append-only — newest entry at the bottom)

### Session 1
- Took the original v1.0 NosChatV3 spec (Flutter + Rust/Axum + Clerk + Firebase + Cloudflare R2 + managed cloud hosting) and reworked it for the user's actual plan: Postgres + backend self-hosted on homelab via Docker, frontend on Vercel, connected via custom domain, zero Firebase.
- Clarified with user: no Firebase at all, backend framework = "best for the app" → chose Rust + Axum, frontend framework = "best and looks best" → chose Next.js.
- Made an unprompted but necessary call: replaced Clerk (cloud auth) with self-hosted auth, since Clerk contradicts the "fully hosted locally" requirement. Flagged this clearly to the user.
- Produced `NosChatV3-Spec-v2.md` — full rewrite of tech stack, auth, frontend, backend hosting notes, file storage (MinIO replacing R2), push notifications (Web Push replacing FCM), and a new Section 24 (Deployment & Infrastructure Architecture).
- Created this file (`CLAUDE.md`) as the persistent session-continuity file.
- **No code written yet.** Next session should start at Section 4, Step 1.

### Session 2
- Verified local toolchain: Node, npm, rustc, cargo, Docker, git — all present.
- Confirmed with user: **monorepo** structure, new folder **NosChatV3**.
- Created `NosChatV3/` folder, ran `git init` (branch `main`).
- Scaffolded `frontend/` via `create-next-app` (TypeScript, Tailwind, App Router, ESLint, `src/` dir, `@/*` alias) and initialized shadcn/ui. **Verified `npm run build` succeeds.** Fixed a Turbopack root-detection warning by pinning `turbopack.root` in `next.config.ts`.
- Scaffolded `backend/` as a Cargo workspace with `auth-service` as the first member. Wrote a minimal Axum server with a `/health` endpoint that reports DB connectivity without crashing if Postgres is unreachable. **Verified `cargo build` succeeds**, and verified by actually running the binary and curling `/health`.
- Wrote `docker-compose.yml` for local dev (Postgres 16 + Redis 7). **Attempted to run it — failed because Docker Desktop wasn't running on this machine.** Flagged as unverified rather than marked done.
- Wrote root `.gitignore`, `backend/auth-service/.env.example`.
- Made the initial commit (`778a913`, 30 files) to the local `main` branch.
- Carried this CLAUDE.md into the new repo root, flagged `NosChatV3-Spec-v2.md` as missing from the repo.
- Second commit: updated CLAUDE.md with accurate session-2 status.

### Session 3
- User confirmed Docker was now running. Ran `docker compose up -d` — both `noschat-postgres-dev` and `noschat-redis-dev` came up and reported `healthy`/`Up`.
- Ran `auth-service` against the now-live Postgres container — got `{"db":false,...}` unexpectedly (should have been `true`). Investigated:
  - Postgres container logs showed **zero connection attempts** at the times the Rust app tried to connect — meaning the connections weren't reaching the container at all, despite the error message being the classic "password authentication failed."
  - Wrote a throwaway Node.js (`pg` library) test script to check whether this was Rust/sqlx-specific — same failure, same message, confirming it was environmental, not a code bug.
  - Ran `netstat -ano | findstr :5432` and found **two different processes** bound to port 5432 on this machine: Docker's backend, and a pre-existing native Windows `postgres.exe` service unrelated to this project. Windows was routing new connections to the native service (with different real credentials), producing the misleading auth-failure message.
  - **Fix:** remapped the Docker Postgres container to host port **5433** in `docker-compose.yml`, updated `DATABASE_URL` defaults in `auth-service/src/main.rs` and `.env.example` to match. Recreated containers (`docker compose down && docker compose up -d`), reconfirmed with `netstat` that 5433 has no conflict, reconfirmed connectivity with the same Node.js test script (success), then ran `auth-service` again.
  - **Confirmed `GET /health` now returns `{"db":true,"service":"auth-service","status":"ok"}`** — full local chain (Rust → sqlx → Docker Postgres) verified working end-to-end for the first time.
  - Cleaned up: killed the test `auth-service.exe` process, deleted the throwaway Node test folder and run logs, nothing test-related left in the repo.
- Documented the port-conflict quirk prominently in Section 2 (with the diagnostic command to check first if this ever resurfaces) and in the Decisions log, so a future session doesn't waste time re-debugging the same misleading error.
- **Session ends here, local dev environment is fully working.** Next session starts at Section 4, Step 1: get the real spec file into the repo before starting on the DB schema.

---

## 7. Key Constraints to Never Violate (quick reference)

- No Firebase, anywhere, for anything.
- No Clerk/Auth0/Supabase or any third-party auth-as-a-service as the primary identity system.
- No managed cloud database as the primary datastore — Postgres lives on the homelab.
- No managed object storage (S3/R2) as the primary file store — MinIO is primary.
- Only the reverse proxy container should ever be internet-facing on the homelab — Postgres/Redis/OpenSearch/MinIO stay on the internal Docker network only.
- Frontend (Vercel) and backend (homelab) talk only over HTTPS/WSS via the custom domain — never assume they're on the same host.
