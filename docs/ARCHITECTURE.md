# Speow! architecture

> **Naming note.** The product is **Speow!** (core action: *a Speow*). The codebase
> predates the rebrand and keeps its original internal identifiers — `zynks` table,
> `/zynks` routes, `@zynk/*` packages, `Zynk*` components, `zynk_*` sound files,
> `ZYNK_*` env vars, the `zynk://` URL scheme and the `app.zynk` bundle id. They are
> persistent or internal and are deliberately not renamed; see
> [SETUP.md](SETUP.md#brand-identifiers-kept-from-the-previous-name).

The repository started empty, so the stack was chosen fresh:

| Concern | Choice | Why |
|---|---|---|
| Mobile | **Expo SDK 58**, React Native 0.88, expo-router, TypeScript | One codebase for iOS + Android, Continuous Native Generation (no hand-edited `ios/`/`android/`), EAS for builds/signing |
| Server state | TanStack Query | Caching, polling, optimistic updates |
| API | **Fastify 5** + `pg` (no ORM) + zod | Small, fast, explicit SQL; zod schemas shared with the app |
| Database | **PostgreSQL 16**, plain SQL migrations (`apps/server/migrations`) | Constraints + partial unique indexes do real work (idempotency, dedupe) |
| Auth | Own: scrypt password hashes + opaque session tokens (sha256 stored) | No vendor needed for username/password; revocable sessions; nothing secret in the client |
| Push | **Expo Push Service** → FCM (Android) / APNs (iOS) | Free, one token format for both platforms, receipts for dead-token cleanup |
| Purchases | **RevenueCat** (`react-native-purchases`) + server-side verification | StoreKit 2 + Play Billing behind one SDK; webhooks + REST let the *server* own entitlement truth |

## Layout

```
packages/shared/src
  features.ts         feature ids, entitlement → features map
  entitlements.ts     resolveFeatures(grants, now) — the one entitlement resolver
  catalog.ts          sounds, reaction packs, themes, accents, bubble colors, effects
  personalization.ts  effectiveSelection(), resolveIncomingSound(), resolveIncomingPresentation()
  color.ts            WCAG contrast helpers (catalog tests enforce AA)
  api.ts              zod request schemas + response types + push payload types

apps/server/src
  app.ts              Fastify setup, auth hook, error envelope, rate limiting, CORS
  config.ts           env parsing (all limits, plans and prices are configurable)
  modules/
    auth/             register, login, logout, password change, account deletion
    users/            profiles, avatar choice, search, invite links (+ /i/:code landing page)
    friends/          requests, friendships
    safety/           blocks, mutes, reports
    zynks/            send (validation → limits → persist → push), activity, seen, reactions
    preferences/      selected vs effective preferences, per-friend sounds
    entitlements/     grants → features, subscription summary
    billing/          RevenueCat REST client, snapshot mapping, sync, webhooks
    push/             provider interface, Expo provider, dispatcher (async, receipts)
    devices/          push token registration
    admin/            moderation + promo grants (only when ADMIN_API_TOKEN is set)
  jobs/retention.ts   data retention

apps/mobile/src
  app/                expo-router routes: (auth), (app)/(tabs){index,activity,add,profile},
                      user/[id], settings/*, plus, report/[id], invite/[code]
  components/ui       design system (Text, Button, Card, Avatar, Input, Rows, Dialog, Toast, States, Icon)
  components/brand    Logo (same geometry as the app icon) + Wordmark
  components/zynk     ZynkButton, ZynkBurst (effects), ReactionGlyph (incl. custom Y2K art),
                      ReactionPicker, IncomingZynkOverlay, useSendZynk, PushPrompt
  lib/                api client, session, queries/hooks, notifications, purchases, sounds, haptics
  theme/              tokens + ThemeProvider (driven by server-effective preferences)
```

## The Speow flow

`POST /zynks { recipientId, clientNonce, reactionId?, effectId? }`

1. **Validate** body (zod). Self-sends rejected.
2. **Idempotency**: `(sender_id, client_nonce)` is unique. A retry returns the original Speow (`duplicate: true`, HTTP 200). The app generates one nonce per tap and reuses it for its automatic network retry.
3. **Relationship**: recipient must be active, a friend, and not blocked in either direction. Blocks are reported as `not_friends` so they can't be probed.
4. **Entitlements**: the reaction pack and effect are checked against the *sender's* verified features. The sender's stored outgoing sound / bubble color / effect are applied only if still entitled (`effectiveSelection`), otherwise Free defaults.
5. **Anti-abuse** (inside a transaction holding a per-sender advisory lock, so concurrent requests can't race past limits): per-friend cooldown (2s), per-friend/min (12), per-sender/min (60), per-sender/hour (600). All configurable; none are daily quotas.
6. **Persist** the event (with a Unicode fallback glyph for the reaction).
7. **Respond**, then **push asynchronously** (`PushDispatcher`). Push outcome is recorded on the Speow (`push_status`, `push_skip_reason`) but never affects delivery: the Speow is always in Activity.

Client-side: `useSendZynk` locks out repeated taps while a request is in flight and honours server `retryAfterMs`. The sender gets an instant burst animation, haptic and (quiet) outgoing sound.

### Receiving

* **Push** (if enabled + permitted): the dispatcher skips when the recipient disabled push/Speow push, muted the sender, or a push from the same sender went out in the last 10s (collapse). It resolves the sound with the *recipient's* settings (below) and sets the iOS badge to the unseen count.
* **In-app**: Activity polls every 8s while the app is foregrounded, and a foreground push triggers an immediate fetch. New Speows show the `IncomingZynkOverlay` (animation + sound + "Speow back"). Foreground pushes for Speows suppress the system banner/sound so the user isn't double-notified.
* **Deep links**: push data carries `zynk://activity?zynk=<id>` / `zynk://user/<id>` / `zynk://add`. Only an allowlisted set of paths is routed (`urlToPath`).

## Entitlements

```
identity (users)
  └─ subscriptions          store state mirrored from RevenueCat (status, expiry, renew, sandbox) — display/audit
  └─ entitlement_grants     what the user is owed: ("plus", source store|promo|admin, starts, expires, revoked)
        └─ resolveFeatures()  →  custom_sounds, premium_emoji_packs, custom_themes, exclusive_effects
  └─ preferences            what the user *selected* (kept when Plus lapses)
        └─ effectiveSelection(selected, features)  →  what is actually applied
```

* Every premium **operation** is enforced on the server: selecting premium sounds/themes/colors/effects (`PATCH /me/preferences`), per-friend sounds, attaching premium reactions, reacting with premium reactions, per-send effects. Hiding UI is only cosmetic.
* The client reads features only from `GET /me/entitlements` via `useEntitlements/useFeatures/useHasFeature` — there is no `isPremium` flag anywhere in UI code.
* Expiry needs no job: grants carry `expires_at`, resolution is time-based.
* New tiers or one-time purchases: add an entitlement id + feature mapping in `features.ts`; grants with a different `source_ref` coexist.

### Purchase verification

1. App calls `Purchases.purchasePackage()` (RevenueCat, `appUserID` = our user id).
2. App calls `POST /billing/sync`. The server fetches `GET /v1/subscribers/{id}` with the **secret** key and maps it (`mapRevenueCatSubscriber`): active / cancelled (won't renew) / in grace / billing issue / expired / refunded / paused. The grant expiry is the entitlement expiry (or grace-period end); refunds revoke.
3. RevenueCat webhooks (`POST /webhooks/revenuecat`, shared-secret `Authorization` header, idempotent by event id) trigger the same re-fetch for every user id in the event (handles renewals, expirations, cancellations, refunds, transfers). Processing failures return 500 so RevenueCat retries.
4. Pending purchases (Ask to Buy, slow payment methods) grant nothing until the store completes them.

The client never sends receipts or "I'm premium" claims; a forged request to `/billing/sync` simply re-reads the provider.

## Personalization rules (recipient wins)

`resolveIncomingSound` (used by the push dispatcher *and* the in-app overlay):

1. Recipient turned Speow sounds off → silent (iOS `sound: null`, Android `zynk_silent` channel).
2. Recipient assigned a sound to this friend **and** currently owns `custom_sounds` → that sound.
3. Recipient allows friends' sounds and the sender's sound exists → sender's sound (no ownership needed to *hear* it).
4. Otherwise the recipient's own (effective) incoming sound.

`resolveIncomingPresentation`: the sender's bubble color/effect are shown only if the recipient enables "Show friends' colors & effects"; reduced motion (app setting **or** OS setting) always forces the calm animation.

Reactions: everyone can *see* every bundled pack. Unknown refs (a pack added in a newer app version) render the fallback glyph stored on the event.

### Sounds — platform behaviour and limits

* All sounds are original, generated procedurally (`tools/assets/generate-sounds.mjs`); see `apps/mobile/assets/sounds/LICENSE.md`.
* They are bundled in the binary via the `expo-notifications` config plugin. **Notification sounds must be bundled**: neither APNs nor FCM can play arbitrary downloaded audio.
* **iOS**: the push names the file (`zynk_boing.wav`). iOS plays it only if notifications/sounds are allowed and the device isn't silenced or in a Focus that blocks it.
* **Android 8+**: sound is a property of the *notification channel*, so each sound has a channel (`zynk_boing`, …, `zynk_silent`). Users can override every channel in system settings, which always wins.
* **In-app** playback uses `expo-audio` with `playsInSilentMode: false` (iOS silent switch respected) and mixes with other audio. On Android, in-app sounds follow media volume; users can turn them off in Settings → Notifications → Speow sounds.
* Adding a sound: append to `SOUNDS` in `catalog.ts`, add the file + `require` in `lib/sounds.ts` and `app.config.ts`. New sounds reach devices only with a new binary (store release), since notification sounds can't be delivered OTA.

## Safety & privacy

* Blocks are enforced in every query path (search, profiles, requests, Speows, activity) — not just hidden in UI.
* Reports: one open report per (reporter, reported) pair, rate-limited per day, optional Speow evidence restricted to Speows between the two users, username snapshot kept for moderation after account deletion. `moderation_actions` is an audit log. Moderators use the token-protected admin API; nothing about reports is visible to users.
* No contacts access (the permission is explicitly blocked on Android). Discovery is by exact-prefix username or invite link only.
* No public counts. Profiles expose id, username, display name, avatar.
* No profile photos: an avatar is one of 12 drawn characters (`packages/shared/src/avatar-art.ts`) plus a background color, stored as two short ids. Nothing is uploaded.
* Speow colors are free: every send may carry a `bubbleColorId`, validated against the catalog; the push text names the color in the recipient's language (`packages/shared/src/messages.ts`).
* App texts live in `apps/mobile/src/i18n` (English + Italian, same keys enforced by a test). The app language is synced to `preferences.language` so push notifications are written in it.
* Logs omit IPs, query strings, bodies, tokens and passwords.
* Device tokens are tied to the session that registered them: logout or password change removes them; re-registration by another account moves the token; `DeviceNotRegistered` receipts invalidate them.
* Account deletion (password-confirmed) hard-deletes the user and cascades to all personal data; RevenueCat customer data is deleted best-effort. Store subscriptions must be cancelled by the user in the store (the app warns).
* Retention (`jobs/retention.ts`, hourly): Speows older than `ZYNK_RETENTION_DAYS` (180), expired sessions, invalidated tokens (30d), processed billing events (90d), answered friend requests (90d).

## Data model

See `apps/server/migrations/001_initial.sql`. Key constraints:

* `users.username` — `citext` unique + format check.
* `friendships(user_a < user_b)` — one row per pair.
* `friend_requests` — partial unique index on pending `(from, to)`.
* `zynks(sender_id, client_nonce)` — unique (idempotency); indexes for recipient/sender/pair timelines and unseen counts.
* `entitlement_grants(user_id, source, source_ref)` — unique.
* `billing_events.id` — webhook idempotency.
* Everything user-owned cascades on user deletion; reports `set null`.

## Design system

Tokens live in `packages/shared/src/brand.ts` + `apps/mobile/src/theme/tokens.ts`:
Near-black `#111111` + Acid Lime `#D7FF36` primary, White `#FFFFFF`, neutral grays (`gray100…gray900`) for secondary text, dividers and disabled states; Purple, Electric Blue and Pink remain as secondary accents for premium themes/colors.
Type: **Unbounded** ExtraBold (heavy display face for the `Speow!` wordmark and headings) + **Space Grotesk** (UI), both OFL via `@expo-google-fonts`.
Logo: a compact speech bubble with a small impact burst popping off its corner and a `!` punched out — geometry in `tools/assets/logo.mjs`, rendered in-app from `assets/brand/logo-paths.json` and rasterized into every icon. Works in one color (`logo-mono.svg`).
Dark (theme id `night`) is the primary experience; Light (id `daylight`) is a full light theme where lime elements get an ink outline for contrast. Premium themes (Ultraviolet, Deep Sea, Bubblegum) keep the Speow! logo, type and lime-first accents.
Catalog tests enforce WCAG AA for every swatch/ink pair and theme text; `accentText` falls back to the theme's text color when an accent isn't readable as text.
Red/green "status" hues are excluded from user colors so personalization can't imitate system/security indicators.
