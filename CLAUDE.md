# CLAUDE.md — NosChatV3 Project Context & Session Protocol

> **This file is the single source of truth for project state.** Read this entire file before doing anything else in a session. It should always reflect reality — if it's out of date, that's a bug, fix it as part of your work.

---

## 0. How to Use This File (read this first, every session)

1. **On session start:** Read this whole file top to bottom before writing any code or making any changes. Do not ask the user "what were we working on" — it's answered in Section 3 (Current Status) and Section 4 (Next Steps).
2. **Check the spec:** `NosChatV3-Spec-v2.md` (in the project root) is the full product/architecture spec. This file is the *state tracker*; the spec is the *source of truth for what to build*. If they ever conflict, the spec wins on product decisions, this file wins on "what's actually been done so far."
   - **NOTE (2026-08-13):** The spec file has still not actually been placed in this repo — only this CLAUDE.md was carried over from the planning session. Locate/re-attach `NosChatV3-Spec-v2.md` and add it to the repo root ASAP; until then, Section 1 below is the only architecture reference in-repo.
3. **During the session:** After completing any meaningful step (a feature, a fix, a config change, a decision made with the user, a blocker hit), update this file immediately — don't wait until the end of the session. Meaningful = anything the next session needs to know to not repeat work or re-ask a question.
4. **Update discipline:**
   - Update **Section 3 (Current Status)** so it always reflects the true current state.
   - Append a dated entry to **Section 6 (Session Log)** — never delete old entries, this is an append-only history.
   - Update **Section 4 (Next Steps)** so the next session (or the next step in this one) has a clear, concrete pickup point — not "continue working on backend," but the actual next action.
   - If a decision was made that changes or adds to the spec, note it in **Section 5 (Decisions & Deviations Log)** and reflect it in the actual spec file too.
5. **On session end (or when the user says they're stepping away):** Do one final pass over Sections 3 and 4 to make sure they're accurate, even if nothing "big" happened.
6. **Never mark something done in Section 3 unless it actually is** — verified working, not just written. If it's written but untested, say so explicitly (e.g. "docker-compose.yml written, not yet run — Docker Desktop was down").

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

**Repo structure decision:** Monorepo — `frontend/` (Next.js) and `backend/` (Rust/Axum workspace) live side by side in this repo, confirmed with user 2026-08-13.

---

## 2. Repo / Environment Facts

- **Repo location:** `NosChatV3/` (local git repo, branch `main`, one commit so far — see Section 3)
- **Repo structure:** Monorepo — `frontend/`, `backend/`, `docker-compose.yml` at root
- **Repo remote:** none configured yet — repo exists only on this local machine
- **Homelab access:** not yet documented — note IP/hostname conventions, Docker host details, how to reach it once set up
- **Domain name in use:** not yet provided by user
- **Vercel project:** not yet created
- **Local dev — how to run:**
  - Frontend: `cd frontend && npm run dev` (Next.js dev server)
  - Backend: `cd backend && cargo run --bin auth-service` (binds `0.0.0.0:4000`, exposes `GET /health`)
  - Local DB/cache: `docker compose up -d` from repo root (Postgres on 5432, Redis on 6379) — **requires Docker Desktop to be running first**; see blocker in Section 3.
- **Local toolchain verified present (2026-08-13):** Node v24.11.0, npm 11.17.0, rustc 1.94.0, cargo 1.94.0, Docker 29.6.2 (Desktop app itself not running — see Section 3 blocker), git 2.51.2
- **Secrets / env vars:** `backend/auth-service/.env.example` documents the expected names (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`) with placeholder values only. No real `.env` created, nothing secret exists yet.

---

## 3. Current Status

**Phase:** Initial scaffolding done and verified (with one piece — the local DB stack — written but not yet run). No feature code (auth logic, DB schema, real UI) written yet.

**What exists and is VERIFIED working:**
- `frontend/` — Next.js 16 (App Router, TypeScript, Tailwind v4, ESLint), scaffolded via `create-next-app`. shadcn/ui initialized (`components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx` present). **`npm run build` succeeds cleanly** (verified 2026-08-13). `next.config.ts` explicitly pins `turbopack.root` — needed because a stray `package-lock.json` in a parent directory outside the repo was confusing root detection; without this fix the build still worked but printed a warning.
- `backend/` — Cargo workspace with one member, `auth-service`. Workspace-level `Cargo.toml` centralizes shared dependency versions (axum 0.7, tokio, sqlx 0.8 w/ postgres+uuid+chrono+migrate, argon2, jsonwebtoken 9, tracing, dotenvy, thiserror, anyhow). **`cargo build` succeeds cleanly** (verified 2026-08-13, ~1m34s cold build, 247 packages).
- `backend/auth-service/src/main.rs` — minimal Axum server: binds `0.0.0.0:4000`, reads `DATABASE_URL` from env (falls back to `postgres://noschat:noschat@localhost:5432/noschat` if unset), attempts a Postgres connection at startup via `sqlx::PgPoolOptions` **without crashing if it fails** (logs a warning instead), and exposes `GET /health` returning `{"status":"ok","service":"auth-service","db": <bool>}`. **Verified by actually running it**: started the binary, curled `/health`, got `{"db":false,"service":"auth-service","status":"ok"}` (db:false is correct here — Postgres wasn't up), then killed the process cleanly. No real auth logic (routes, DB schema, JWT issuing, Argon2 hashing) implemented yet — just the skeleton + health check.
- `backend/auth-service/.env.example` — template env var names, placeholder values only.
- `docker-compose.yml` at repo root — Postgres 16 + Redis 7 for **local dev only** (homelab prod stack with OpenSearch/MinIO/mediasoup/coturn/Caddy comes later, per spec Section 24). **WRITTEN BUT NOT YET RUN** — see blocker below.
- `.gitignore` — excludes `node_modules/`, `.next/`, `target/`, all `.env*` except `.env.example`.
- Git repo initialized, branch `main`, **initial commit made** (`778a913` — "Initial scaffold: Next.js frontend + Rust/Axum backend workspace...", 30 files). No remote — this only exists locally right now.

**Active blocker:**
- **Docker Desktop is not running on this machine.** `docker compose up -d` failed with: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified`. This means `docker-compose.yml` has **not actually been run** — Postgres/Redis containers have never started. The `db:false` in the `/health` check above is *consistent with* Docker being down but is not proof the compose file itself is correct — that still needs a real run once Docker Desktop is started (see Next Steps #1).

**What does NOT exist yet:**
- No repo remote (GitHub/GitLab/self-hosted Git/etc.) — repo is local-only, one commit, no push destination configured. (Worth asking the user which they want, given the project's "avoid third-party where possible" spirit — don't just default to GitHub without asking.)
- No auth logic at all: no DB schema/migrations, no user table, no Argon2id password hashing, no JWT issuance/validation, no TOTP, no WebAuthn.
- No frontend auth pages, no layout beyond the default `create-next-app` boilerplate homepage.
- No homelab Docker stack, no domain/DNS/reverse proxy config, no Vercel project.
- `NosChatV3-Spec-v2.md` has **not been placed in the repo** — it was produced in the prior planning session but only this CLAUDE.md carried over. Section 1 above is a summary only, not a substitute for the real spec.
- Minor cosmetic note: `create-next-app` auto-generated `frontend/CLAUDE.md` (a one-line stub: `@AGENTS.md`) and `frontend/AGENTS.md` (Next.js's own agent guidance). These are unrelated to this root `CLAUDE.md` and harmless — don't confuse the two if grepping the repo for "CLAUDE.md".

---

## 4. Next Steps (concrete pickup point)

1. **Start Docker Desktop**, then from repo root run `docker compose up -d` and check `docker compose ps` shows `noschat-postgres-dev` and `noschat-redis-dev` both healthy. Then re-run `auth-service` (`cargo run --bin auth-service` from `backend/`) and confirm `curl http://localhost:4000/health` now returns `"db":true`. This closes out the one unverified piece from this session.
2. **Locate and re-add `NosChatV3-Spec-v2.md`** to the repo root — it exists from the prior planning session but was never placed on disk here; ask the user for it if it can't be found elsewhere. Until it's in-repo, treat Section 1 above as the only architecture reference.
3. Once Postgres is confirmed reachable: design and write the first `sqlx` migration for `auth-service` — at minimum a `users` table (id, email, username, password_hash, created_at, etc.). Check the re-attached spec for the exact intended schema before inventing one.
4. Implement real auth-service routes: `POST /register` (Argon2id hash + insert user), `POST /login` (verify password, issue JWT), wired to the real DB via `sqlx::query!` (compile-time checked — needs `DATABASE_URL` reachable at build time, or `cargo sqlx prepare` for offline builds).
5. On the frontend: build basic login/register pages (`frontend/src/app/(auth)/login`, `.../register`) that call the auth-service endpoints once they exist — Phase 1 MVP scope only, no real-time features yet.
6. Set up a remote for the repo — confirm with the user whether they want GitHub, GitLab, or self-hosted Git on the homelab before defaulting to anything.
7. Homelab Docker stack + domain/DNS/reverse proxy (Spec Section 24) comes after steps 1–6 are solid locally — don't jump ahead to this.

**Immediate next action if resuming right now:** Step 1 — start Docker Desktop and verify the local dev compose stack actually runs, since that's the one thing written this session but not yet confirmed working.

---

## 5. Decisions & Deviations Log

*(Anything decided that adds to, changes, or deviates from the spec — so it's not lost or re-litigated. Most recent first.)*

- **2026-08-13** — Confirmed monorepo structure (frontend + backend in one repo) with user, per the open question left in Section 4 of the previous session's CLAUDE.md.
- **2026-08-13** — Pivoted away from Flutter/Clerk/Firebase/Cloudflare R2 (original v1.0 spec) to Next.js/self-hosted-auth/MinIO, because the user's actual hosting plan (homelab backend+DB, Vercel frontend, custom domain, zero Firebase) required it. Full rationale in spec Section 24 and ADR log (spec file to be re-attached, see Section 0.2 note).

---

## 6. Session Log (append-only — newest entry at the bottom)

### 2026-08-13 — Session 1
- Took the original v1.0 NosChatV3 spec (Flutter + Rust/Axum + Clerk + Firebase + Cloudflare R2 + managed cloud hosting) and reworked it for the user's actual plan: Postgres + backend self-hosted on homelab via Docker, frontend on Vercel, connected via custom domain, zero Firebase.
- Clarified with user: no Firebase at all, backend framework = "best for the app" → chose Rust + Axum, frontend framework = "best and looks best" → chose Next.js.
- Made an unprompted but necessary call: replaced Clerk (cloud auth) with self-hosted auth, since Clerk contradicts the "fully hosted locally" requirement. Flagged this clearly to the user.
- Produced `NosChatV3-Spec-v2.md` — full rewrite of tech stack, auth, frontend, backend hosting notes, file storage (MinIO replacing R2), push notifications (Web Push replacing FCM), and a new Section 24 (Deployment & Infrastructure Architecture).
- Created this file (`CLAUDE.md`) as the persistent session-continuity file.
- **No code written yet.** Next session should start at Section 4, Step 1.

### 2026-08-13 — Session 2
- Verified local toolchain: Node v24.11.0, npm 11.17.0, rustc 1.94.0, cargo 1.94.0, Docker 29.6.2, git 2.51.2 — all present, no installs needed.
- Confirmed with user: **monorepo** structure, new folder **NosChatV3**.
- Created `NosChatV3/` folder, ran `git init` (branch `main`).
- Scaffolded `frontend/` via `create-next-app` (TypeScript, Tailwind, App Router, ESLint, `src/` dir, `@/*` alias) and initialized shadcn/ui (`shadcn init -d`). **Verified `npm run build` succeeds.** Fixed a Turbopack root-detection warning by pinning `turbopack.root` in `next.config.ts` (caused by an unrelated `package-lock.json` in a parent directory outside the repo) — rebuilt clean afterward.
- Scaffolded `backend/` as a Cargo workspace with `auth-service` as the first member, matching the Next Steps priority from Session 1 ("auth-service first, since everything else depends on it"). Wrote a minimal Axum server with a `/health` endpoint that reports DB connectivity without crashing if Postgres is unreachable. **Verified `cargo build` succeeds**, and verified by actually running the binary and curling `/health` (`{"db":false,...}`, correctly reflecting Postgres being unreachable), then killed the process.
- Wrote `docker-compose.yml` for local dev (Postgres 16 + Redis 7). **Attempted to run it — failed because Docker Desktop isn't running on this machine** (Docker CLI is installed and working, but the Desktop daemon itself is off). This is now the top item in Next Steps — written but genuinely unverified, flagged as such rather than marked done.
- Wrote root `.gitignore`, `backend/auth-service/.env.example`.
- Made the initial commit (`778a913`, 30 files) to the local `main` branch. No remote configured yet — repo exists only on this machine.
- Carried this CLAUDE.md into the new repo root and flagged that `NosChatV3-Spec-v2.md` still needs to be located and re-attached — it was never actually placed in this repo, only referenced.
- **Session ends here.** Next session (or next step in this one) starts at Section 4, Step 1: start Docker Desktop and verify the local Postgres/Redis stack for real.

---

## 7. Key Constraints to Never Violate (quick reference)

- No Firebase, anywhere, for anything.
- No Clerk/Auth0/Supabase or any third-party auth-as-a-service as the primary identity system.
- No managed cloud database as the primary datastore — Postgres lives on the homelab.
- No managed object storage (S3/R2) as the primary file store — MinIO is primary.
- Only the reverse proxy container should ever be internet-facing on the homelab — Postgres/Redis/OpenSearch/MinIO stay on the internal Docker network only.
- Frontend (Vercel) and backend (homelab) talk only over HTTPS/WSS via the custom domain — never assume they're on the same host.
