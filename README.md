# zynk — MAKE SOME NOISE.

ZYNK is a lightweight social app built around one action: sending a playful
signal — a **Zynk** — to a friend. No chat, no feed, no follower counts, no ads.

This monorepo contains the iOS/Android app, the API, and shared contracts.

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 58 / React Native 0.88 app (expo-router, TypeScript) |
| `apps/server` | Fastify 5 + PostgreSQL API (TypeScript) |
| `packages/shared` | Catalogs, feature/entitlement model, personalization rules, zod API contract |
| `tools/assets` | Generators for the logo, app icons and the original synthesized sounds |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [Setup: push, purchases, deployment](docs/SETUP.md) |

## Quick start

Requirements: Node 22+, PostgreSQL 16 (local, Docker, or the bundled test script).

```bash
npm install

# Database — pick one:
docker compose up -d db                       # postgres://zynk:zynk@localhost:5432/zynk
# or: npm run db:test:start                   # throwaway cluster on :54329 (no Docker needed)

# API
cp apps/server/.env.example apps/server/.env  # adjust DATABASE_URL if needed
npm run migrate -w @zynk/server
npm run cli -w @zynk/server -- seed           # optional sample users (password: zynkzynk)
npm run dev -w @zynk/server                   # http://localhost:4000/health

# App (needs a development build for push + purchases; see docs/SETUP.md)
cd apps/mobile
npx expo run:ios      # or: npx expo run:android, or eas build --profile development
npx expo start        # then open the dev build
```

In development the app talks to `http://<metro-host>:4000` automatically; set
`EXPO_PUBLIC_API_URL` to override (see `apps/mobile/.env.example`).

## Commands

| Command | Does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint (`expo lint`) for the app |
| `npm test` | shared (vitest), server (vitest + real Postgres), mobile (jest-expo) |
| `npm run db:test:start` / `db:test:stop` | Ephemeral Postgres for server tests (`TEST_DATABASE_URL` overrides) |
| `npm run build -w @zynk/server` | Bundles the API to `apps/server/dist` |
| `npm run cli -w @zynk/server -- migrate\|retention\|seed` | Migrations, retention job, dev seed |
| `npx expo export --platform ios --platform android` (in `apps/mobile`) | Production JS bundles |
| `npm run generate -w @zynk/assets-tools` | Regenerate icons and sounds |

## Free vs Plus

Sending Zynks is never paywalled. Anti-spam limits (cooldowns, per-minute/hour
caps) apply equally to everyone and are configured separately from monetization.

| | ZYNK Free | ZYNK Plus |
|---|---|---|
| Unlimited standard Zynks (anti-spam limits only) | ✓ | ✓ |
| Friends, invites, Activity, seen state, Zynk back | ✓ | ✓ |
| Blocking, muting, reporting, notification settings | ✓ | ✓ |
| Classic animation + Classic sound, haptics | ✓ | ✓ |
| Basic reactions (8) — attach to a Zynk or react to one | ✓ | ✓ |
| Night + Daylight themes, Acid Lime accent & bubble | ✓ | ✓ |
| **Receiving** any premium sound / reaction / effect | ✓ | ✓ |
| 8 exclusive original sounds (incoming + outgoing) | preview only | ✓ |
| Per-friend sounds (recipient side) | — | ✓ |
| Y2K Stickers + animated "Moves" reaction packs | preview only | ✓ |
| 3 extra themes, 5 accent colors, 6 bubble colors | preview only | ✓ |
| Shockwave, Thunderbolt, Confetti pop, Starburst effects (+ sound combos) | preview only | ✓ |

Launch pricing (configurable, never hardcoded in UI): **€1.99/month**, **€14.99/year**.
The app shows the store's localized price when available.

## Status

See the final section of [docs/SETUP.md](docs/SETUP.md#status-and-known-limitations)
for what is verified, what needs store/push credentials, and known limitations.
