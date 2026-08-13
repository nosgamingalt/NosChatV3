# CLAUDE.md — NosChatV3 Project Context & Session Protocol

> **This file is the single source of truth for project state.** Read this entire file before doing anything else in a session. It should always reflect reality — if it's out of date, that's a bug, fix it as part of your work.

---

## 0. How to Use This File (read this first, every session)

1. **On session start:** Read this whole file top to bottom before writing any code or making any changes. Do not ask the user "what were we working on" — it's answered in Section 3 (Current Status) and Section 4 (Next Steps).
2. **Check the spec:** `NosChatV3-Spec-v2.md` (in the project root) is the full product/architecture spec. This file is the *state tracker*; the spec is the *source of truth for what to build*. If they ever conflict, the spec wins on product decisions, this file wins on "what's actually been done so far."
   - **NOTE (2026-08-13):** The spec file has not actually been placed in this repo yet — only this CLAUDE.md was carried over from the planning session. Locate/re-attach `NosChatV3-Spec-v2.md` and add it to the repo root as soon as possible; until then, this file's Section 1 summary is the only architecture reference in-repo.
3. **During the session:** After completing any meaningful step (a feature, a fix, a config change, a decision made with the user, a blocker hit), update this file immediately — don't wait until the end of the session. Meaningful = anything the next session needs to know to not repeat work or re-ask a question.
4. **Update discipline:**
   - Update **Section 3 (Current Status)** so it always reflects the true current state.
   - Append a dated entry to **Section 6 (Session Log)** — never delete old entries, this is an append-only history.
   - Update **Section 4 (Next Steps)** so the next session (or the next step in this one) has a clear, concrete pickup point — not "continue working on backend," but the actual next action.
   - If a decision was made that changes or adds to the spec, note it in **Section 5 (Decisions & Deviations Log)** and reflect it in the actual spec file too.
5. **On session end (or when the user says they're stepping away):** Do one final pass over Sections 3 and 4 to make sure they're accurate, even if nothing "big" happened.
6. **Never mark something done in Section 3 unless it actually is** — verified working, not just written. If it's written but untested, say so explicitly (e.g. "auth-service scaffolded, not yet tested against homelab Postgres").

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

- **Repo location:** `NosChatV3/` (initialized locally, `git init` done, branch `main`, no remote configured yet)
- **Repo structure:** Monorepo — `frontend/`, `backend/`, `docker-compose.yml` at root
- **Homelab access:** _not yet documented — note IP/hostname conventions, Docker host details, how to reach it once set up_
- **Domain name in use:** _not yet provided by user_
- **Vercel project:** _not yet created_
- **Local dev setup instructions:** see Section 3 "How to run locally" once populated
- **Local toolchain verified present:** Node v24.11.0, npm 11.17.0, rustc 1.94.0, cargo 1.94.0, Docker 29.6.2, git 2.51.2 (checked 2026-08-13)
- **Secrets / env vars:** none defined yet — once they exist, document WHERE they live (e.g. `.env`, not committed) and WHAT they are, never the actual secret values in this file

---

## 3. Current Status

**Phase:** Initial scaffolding in progress.

_(This section is being updated live during the current session — see Section 6 for the latest entry before trusting this snapshot fully.)_

---

## 4. Next Steps (concrete pickup point)

_(Being updated live during the current session — see bottom of Section 6 for the actual current pickup point.)_

---

## 5. Decisions & Deviations Log

*(Anything decided that adds to, changes, or deviates from the spec — so it's not lost or re-litigated. Most recent first.)*

- **2026-08-13** — Confirmed monorepo structure (frontend + backend in one repo) with user, per the open question left in Section 4 of the previous session's CLAUDE.md.
- **2026-08-13** — Pivoted away from Flutter/Clerk/Firebase/Cloudflare R2 (original v1.0 spec) to Next.js/self-hosted-auth/MinIO, because the user's actual hosting plan (homelab backend+DB, Vercel frontend, custom domain, zero Firebase) required it. Full rationale in spec Section 24 and ADR log (spec file to be re-attached, see Section 0.2 note).

---

## 6. Session Log (append-only — newest entry at the bottom)

### 2026-08-13 — Session 1
- Took the original v1.0 NosChatV3 spec (Flutter + Rust/Axum + Clerk + Firebase + Cloudflare R2 + managed cloud hosting) and reworked it for the user's actual plan: Postgres + backend self-hosted on homelab via Docker, frontend on Vercel, connected via custom domain, zero Firebase.
- Clarified with user: no Firebase at all, backend framework = "best for the app" → chose Rust + Axum (kept from original, still the right call for homelab WebSocket concurrency), frontend framework = "best and looks best" → chose Next.js (best fit for Vercel).
- Made an unprompted but necessary call: replaced Clerk (cloud auth) with self-hosted auth, since Clerk contradicts the "fully hosted locally" requirement. Flagged this clearly to the user rather than silently swapping it.
- Produced `NosChatV3-Spec-v2.md` — full rewrite of tech stack, auth, frontend, backend hosting notes, file storage (MinIO replacing R2), push notifications (Web Push replacing FCM), and a new Section 24 (Deployment & Infrastructure Architecture) covering the Vercel↔homelab split, Cloudflare Tunnel vs. DDNS, DNS subdomain layout, and Docker Compose structure. Updated ADR log and phased plan to match.
- Created this file (`CLAUDE.md`) as the persistent session-continuity file, with self-update instructions so future sessions pick up with zero lost context.
- **No code written yet.** Next session should start at Section 4, Step 1.

### 2026-08-13 — Session 2 (in progress)
- Verified local toolchain: Node v24.11.0, npm 11.17.0, rustc 1.94.0, cargo 1.94.0, Docker 29.6.2, git 2.51.2 — all present, no installs needed.
- Confirmed with user: **monorepo** structure, new folder **NosChatV3**.
- Created `NosChatV3/` folder and ran `git init` (branch `main`, no commits yet).
- Carried this CLAUDE.md into the new repo root, updated to reflect monorepo decision and flag that `NosChatV3-Spec-v2.md` still needs to be re-attached to the repo (it exists from the planning session but was never placed on disk here).
- **In progress, continuing this session:** scaffolding `frontend/` (Next.js) and `backend/` (Rust/Axum workspace) — see live updates below as each step completes.

---

## 7. Key Constraints to Never Violate (quick reference)

- No Firebase, anywhere, for anything.
- No Clerk/Auth0/Supabase or any third-party auth-as-a-service as the primary identity system.
- No managed cloud database as the primary datastore — Postgres lives on the homelab.
- No managed object storage (S3/R2) as the primary file store — MinIO is primary.
- Only the reverse proxy container should ever be internet-facing on the homelab — Postgres/Redis/OpenSearch/MinIO stay on the internal Docker network only.
- Frontend (Vercel) and backend (homelab) talk only over HTTPS/WSS via the custom domain — never assume they're on the same host.
