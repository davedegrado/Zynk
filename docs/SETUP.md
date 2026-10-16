# Setup: environments, push, purchases, deployment

Nothing external is configured in this repository: no Expo/EAS project, Firebase
project, Apple/Google developer accounts, RevenueCat project or hosting. The app
and API run fully without them (push and purchases report themselves as
unavailable). This page lists exactly what to configure for each.

## 1. Environment variables

### Server (`apps/server/.env`, see `.env.example`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✓ | — | PostgreSQL 13+ connection string |
| `NODE_ENV` | | `development` | `production` disables `seed` |
| `PORT` / `HOST` | | `4000` / `0.0.0.0` | |
| `PUBLIC_URL` | prod | `http://localhost:4000` | Base for invite links `PUBLIC_URL/i/<code>` |
| `TRUST_PROXY` | prod | `false` | Set `true` behind a load balancer so rate limits see real client IPs |
| `CORS_ORIGINS` | | empty (off) | Only needed for browser clients |
| `LOG_LEVEL` | | `info` | |
| `SESSION_TTL_DAYS` | | `60` | Sliding expiry |
| `PUSH_PROVIDER` | | `log` | `expo` in production; `log` prints; `none` disables |
| `EXPO_ACCESS_TOKEN` | | — | Only if "Enhanced push security" is on for the Expo project |
| `REVENUECAT_SECRET_API_KEY` | for Plus | — | RevenueCat **secret** v1 key (`sk_…`). Unset = purchases disabled |
| `REVENUECAT_WEBHOOK_AUTH` | for Plus | — | Long random string; same value in RevenueCat webhook "Authorization header" |
| `REVENUECAT_ENTITLEMENT_ID` | | `plus` | Must match the RevenueCat entitlement identifier |
| `PLANS_JSON` | | built-in | Product ids, periods, fallback prices, badges — see `config.ts` `DEFAULT_PLANS` |
| `PROMO_MESSAGE` | | — | Optional line on the Plus screen |
| `ZYNK_PAIR_COOLDOWN_MS` | | `2000` | Anti-spam (not monetization) |
| `ZYNK_PAIR_MAX_PER_MINUTE` | | `12` | |
| `ZYNK_SENDER_MAX_PER_MINUTE` | | `60` | |
| `ZYNK_SENDER_MAX_PER_HOUR` | | `600` | |
| `ZYNK_PUSH_COLLAPSE_MS` | | `10000` | Max one push per sender→recipient per window |
| `FRIEND_REQUESTS_MAX_PER_HOUR` | | `40` | |
| `REPORTS_MAX_PER_DAY` | | `20` | |
| `AUTH_MAX_PER_MINUTE` | | `10` | Per IP on login/register/password routes |
| `ZYNK_RETENTION_DAYS` | | `180` | `0` keeps Zynks forever |
| `RETENTION_INTERVAL_MINUTES` | | `60` | `0` disables the in-process job (run `cli retention` from cron instead) |
| `ADMIN_API_TOKEN` | | — | ≥24 chars; enables `/admin/*` (moderation, promo grants). Send as `x-admin-token` |

### App (`apps/mobile/.env`, see `.env.example`; or `env` in `eas.json` profiles)

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | API base URL. Dev default: `http://<metro host>:4000` |
| `EXPO_PUBLIC_INVITE_BASE_URL` | Defaults to the API URL; should equal the server's `PUBLIC_URL` |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` | RevenueCat **public** SDK keys (`appl_…` / `goog_…`). Empty = purchases hidden behind "not available yet" |
| `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` | Shown on the Plus screen (App Review requires them for subscriptions) |
| `EAS_PROJECT_ID` | Required for Expo push tokens in builds (`eas init` prints it) |
| `GOOGLE_SERVICES_JSON` | Path to `google-services.json` (FCM) for Android builds |
| `APP_VARIANT=development` | Separate bundle id `app.zynk.dev` for dev builds |
| `ZYNK_LINK_DOMAIN` | Optional: adds iOS `applinks:` for universal links |

Bundle id / package: `app.zynk` (change in `app.config.ts` before the first store upload).

## 2. Database

```bash
npm run migrate -w @zynk/server        # applies apps/server/migrations/*.sql in order, idempotent, locked
```
The server also migrates on boot. Add new migrations as `002_<name>.sql`; never edit applied files.
Requires the `citext` extension (available on all major managed Postgres offerings) and `gen_random_uuid()` (core since PG13).

## 3. Push notifications (Expo → FCM / APNs)

1. `cd apps/mobile && npx eas-cli@latest init` → sets the EAS project; put the id in `EAS_PROJECT_ID`.
2. **Android / FCM**: create a Firebase project, add Android app `app.zynk`, download `google-services.json`, set `GOOGLE_SERVICES_JSON=./google-services.json`. Upload the FCM v1 service-account key to EAS: `npx eas-cli@latest credentials` → Android → Push Notifications (FCM V1).
3. **iOS / APNs**: requires an Apple Developer account. `eas build` / `eas credentials` creates the APNs key automatically.
4. Server: `PUSH_PROVIDER=expo` (and `EXPO_ACCESS_TOKEN` if you enable enhanced security).
5. Test on a **physical device** with a development or preview build (push doesn't work in simulators/emulators without Play services, nor in Expo Go for this app).

The app never prompts for permission on launch: it shows a contextual card on the Friends screen and a button in Settings → Notifications.

## 4. Purchases (RevenueCat + App Store + Google Play)

RevenueCat was chosen over hand-rolled StoreKit/Play receipt validation: one SDK for both stores, server-to-server REST and webhooks, sandbox handling, and free up to a revenue threshold (see costs). Its secret key lives only on the server.

**App Store Connect**
1. Paid Applications Agreement, tax and banking completed.
2. Create the app (`app.zynk`), a subscription group "ZYNK Plus", products `zynk_plus_monthly` (1 month, €1.99) and `zynk_plus_annual` (1 year, €14.99), with localized names/descriptions and review screenshots.
3. Create an In-App Purchase key (App Store Connect API / IAP key) and upload it to RevenueCat; set the App Store Server Notifications URL to RevenueCat's.
4. Create sandbox testers.

**Google Play Console**
1. Payments profile and merchant account.
2. Upload a build first (internal testing track) with the `BILLING` permission (already declared).
3. Create subscription `zynk_plus` with base plans `monthly` and `annual` → RevenueCat identifiers `zynk_plus:monthly`, `zynk_plus:annual`.
4. Create a service account with financial permissions, upload its JSON to RevenueCat; enable Real-time developer notifications (Pub/Sub) per RevenueCat's guide.
5. Add license testers.

**RevenueCat**
1. Project with the iOS and Android apps; copy the public SDK keys into `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`.
2. Entitlement `plus`; attach all four products.
3. An offering (e.g. `default`) containing monthly and annual packages. The app matches packages to plans by **product identifier**, so offering/package names are free to change.
4. Secret API key (v1) → `REVENUECAT_SECRET_API_KEY` on the server.
5. Webhook → `https://<api>/webhooks/revenuecat`, Authorization header = `REVENUECAT_WEBHOOK_AUTH`.
6. If you change product ids or prices, update `PLANS_JSON` on the server (no app release needed). Displayed prices come from the store whenever loaded; the fallback price is only shown (marked "indicative") when the store price is unavailable.

**Test before claiming it works** — not yet done in this repository:
- [ ] iOS sandbox purchase monthly → Plus unlocks after `/billing/sync`
- [ ] Sandbox renewal / expiry (accelerated) → webhook → Plus locks again
- [ ] Cancel in sandbox → status "cancelled", still active until expiry
- [ ] Refund (StoreKit testing / Play refund) → revoked
- [ ] Ask to Buy / Play "slow test card" → "pending", nothing unlocked until approval
- [ ] Restore on a second device / reinstall
- [ ] Play license tester purchase, upgrade monthly → annual
- [ ] Billing-retry / grace period behaviour

Promo/QA access without the stores: `POST /admin/users/:id/grants { "entitlement": "plus", "days": 30, "ref": "qa" }` with `x-admin-token`. This is a server-side grant, not a client flag.

## 5. Builds and releases

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform ios|android   # dev client
npx eas-cli@latest build --profile preview --platform all               # internal testing
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production
```
Set the production/preview `EXPO_PUBLIC_API_URL` in `eas.json` (placeholders now) or as EAS environment variables.
Local native builds (`npx expo run:ios|android`) need Xcode / Android Studio.

## 6. Deploying the API

* Container: `docker build -f apps/server/Dockerfile .` → `node dist/index.js` (port 4000). Or `npm run build -w @zynk/server && npm start -w @zynk/server`.
* Needs: managed PostgreSQL, HTTPS termination, `TRUST_PROXY=true`, `PUBLIC_URL`, `PUSH_PROVIDER=expo`, RevenueCat variables.
* Health check: `GET /health`.
* Rate limits are in-memory per instance (per-user Zynk/request/report limits are in the database and global). For multiple instances, add a Redis store to `@fastify/rate-limit`.
* The retention job runs in each instance; it is idempotent. Prefer a single cron (`npm run cli -w @zynk/server -- retention`) with `RETENTION_INTERVAL_MINUTES=0` at scale.
* Invite links: `GET /i/:code` serves a small landing page that opens `zynk://invite/<code>`. For tap-to-open without the page, configure iOS Universal Links (`ZYNK_LINK_DOMAIN`, `apple-app-site-association`) and Android App Links (`assetlinks.json`) on your domain.

## 7. Expected costs (verify current prices with each provider)

| Item | Cost |
|---|---|
| Apple Developer Program | US$99 / year |
| Google Play developer account | US$25 one-time |
| Store commission on subscriptions | 15% (Apple Small Business Program / Google subscriptions) to 30% standard |
| RevenueCat | Free up to US$2,500 monthly tracked revenue, then ~1% of tracked revenue (check current plans) |
| Expo Push Service, FCM, APNs | Free |
| EAS Build / Submit | Free tier with limited monthly builds; paid plans for more/priority builds |
| API hosting | One small container (~US$5–25/month) is enough for an early launch |
| PostgreSQL | Managed small instance ~US$0–25/month at launch (data per user is tiny; avatars ≤512 KB live in the DB) |

No other paid services are used. Avatars are stored in Postgres to avoid object storage at launch; move them to S3-compatible storage with a CDN if the user base grows.

## Status and known limitations

**Verified in this environment**
- Shared: 19 unit tests (entitlements, catalogs, WCAG contrast, personalization precedence, usernames).
- Server: 54 integration tests against real PostgreSQL 16 (auth, sessions, profiles/avatars, friends, invites, blocks/mutes/reports, moderation, Zynk send/idempotency/cooldowns/limits/no quota, activity, push decisions and token invalidation, premium enforcement, expiry/revocation, purchase sync/webhooks, outages, account deletion, retention, CORS, rate-limit bypass).
- Mobile: 10 jest-expo tests (theme contrast fallback, deep-link allowlist, purchase error mapping, double-tap protection, idempotent retry, cooldown).
- Typecheck and lint clean across workspaces; server production bundle builds and boots; iOS and Android JS bundles export; `expo prebuild` generates both native projects with sounds, channels, permissions and URL scheme.
- UI exercised in a browser preview (react-native-web) against the live API: login, friends, Zynk send animation, incoming Zynk overlay via polling, activity, add friends, Plus screen, appearance (Night + Daylight).

**Not verified (needs credentials/devices)**
- Native compilation and running on iOS/Android devices (no Xcode/Android SDK here).
- Real push delivery through Expo/FCM/APNs.
- Real store purchases in sandbox (RevenueCat calls are covered by mapped-snapshot tests and a fake provider only).
- The Dockerfile was written but not built (no Docker daemon available).

**Known limitations**
- No email/phone: password reset requires a future recovery channel (deliberate data minimization for the MVP). Users can change passwords while signed in.
- In-app delivery while foregrounded uses 8s polling (+ instant refresh on push). A WebSocket/SSE channel would make it instant without push.
- HTTP rate limits are per instance (see deployment).
- Android in-app sounds follow media volume rather than ringer mode (notification sounds follow system rules).
- New sounds require an app release (notification sounds must be bundled); new reaction packs need an app release to render custom art but older apps show the fallback glyph.
- The web build exists only for previews (no push/purchases); it is not a supported product surface.
