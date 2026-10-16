-- ZYNK initial schema.
create extension if not exists citext;

-- ------------------------------------------------------------------ identity

create table users (
  id               uuid primary key default gen_random_uuid(),
  username         citext not null unique
                   check (username ~ '^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$'),
  display_name     text not null check (char_length(display_name) between 1 and 40),
  password_hash    text not null,
  invite_code      text not null unique,
  status           text not null default 'active' check (status in ('active', 'suspended')),
  avatar           bytea,
  avatar_mime      text check (avatar_mime in ('image/jpeg', 'image/png', 'image/webp')),
  avatar_version   integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  -- sha256 of the opaque bearer token; the token itself is never stored.
  token_hash    bytea not null unique,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index sessions_user_idx on sessions(user_id);
create index sessions_expires_idx on sessions(expires_at);

-- ------------------------------------------------------------------ relationships

create table friend_requests (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references users(id) on delete cascade,
  to_user_id    uuid not null references users(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (from_user_id <> to_user_id)
);
create unique index friend_requests_pending_uniq on friend_requests(from_user_id, to_user_id) where status = 'pending';
create index friend_requests_to_idx on friend_requests(to_user_id) where status = 'pending';

-- One row per friendship, stored with user_a < user_b.
create table friendships (
  user_a      uuid not null references users(id) on delete cascade,
  user_b      uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_b_idx on friendships(user_b);

create table blocks (
  blocker_id  uuid not null references users(id) on delete cascade,
  blocked_id  uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on blocks(blocked_id);

-- Muting silences notifications from a friend; their Zynks still land in Activity.
create table mutes (
  user_id     uuid not null references users(id) on delete cascade,
  muted_id    uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, muted_id),
  check (user_id <> muted_id)
);

-- ------------------------------------------------------------------ zynks

create table zynks (
  id                          uuid primary key default gen_random_uuid(),
  sender_id                   uuid not null references users(id) on delete cascade,
  recipient_id                uuid not null references users(id) on delete cascade,
  client_nonce                uuid not null,
  sound_id                    text,
  effect_id                   text not null,
  bubble_color_id             text not null,
  reaction_id                 text,
  reaction_fallback           text,
  response_reaction_id        text,
  response_reaction_fallback  text,
  created_at                  timestamptz not null default now(),
  seen_at                     timestamptz,
  push_status                 text not null default 'pending'
                              check (push_status in ('pending', 'sent', 'skipped', 'failed')),
  push_skip_reason            text,
  check (sender_id <> recipient_id)
);
-- Idempotency: a retried request with the same nonce returns the original Zynk.
create unique index zynks_sender_nonce_uniq on zynks(sender_id, client_nonce);
create index zynks_recipient_idx on zynks(recipient_id, created_at desc);
create index zynks_sender_idx on zynks(sender_id, created_at desc);
create index zynks_pair_idx on zynks(sender_id, recipient_id, created_at desc);
create index zynks_unseen_idx on zynks(recipient_id) where seen_at is null;
create index zynks_created_idx on zynks(created_at);

-- ------------------------------------------------------------------ preferences

create table preferences (
  user_id               uuid primary key references users(id) on delete cascade,
  push_enabled          boolean not null default true,
  zynk_push             boolean not null default true,
  friend_request_push   boolean not null default true,
  haptics               boolean not null default true,
  sounds_enabled        boolean not null default true,
  allow_sender_sounds   boolean not null default true,
  show_sender_style     boolean not null default true,
  reduce_motion         boolean not null default false,
  appearance            text not null default 'theme' check (appearance in ('theme', 'system')),
  incoming_sound_id     text not null default 'zynk_classic',
  outgoing_sound_id     text not null default 'zynk_classic',
  theme_id              text not null default 'night',
  accent_id             text not null default 'lime',
  bubble_color_id       text not null default 'lime',
  effect_id             text not null default 'classic',
  updated_at            timestamptz not null default now()
);

-- Recipient-side: "when Sam zynks me, play this sound".
create table friend_sounds (
  user_id     uuid not null references users(id) on delete cascade,
  friend_id   uuid not null references users(id) on delete cascade,
  sound_id    text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, friend_id)
);

-- ------------------------------------------------------------------ push

create table device_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  -- Tokens are tied to the session that registered them: logging out removes them.
  session_id      uuid references sessions(id) on delete cascade,
  token           text not null unique,
  platform        text not null check (platform in ('ios', 'android')),
  provider        text not null default 'expo' check (provider in ('expo')),
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  invalidated_at  timestamptz
);
create index device_tokens_user_idx on device_tokens(user_id) where invalidated_at is null;

-- Expo push tickets awaiting a receipt check (to detect dead tokens).
create table push_tickets (
  ticket_id        text primary key,
  device_token_id  uuid not null references device_tokens(id) on delete cascade,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------------ safety

create table reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references users(id) on delete set null,
  reported_user_id  uuid references users(id) on delete set null,
  zynk_id           uuid references zynks(id) on delete set null,
  reason            text not null check (reason in ('spam', 'harassment', 'impersonation', 'inappropriate_profile', 'underage', 'other')),
  details           text check (char_length(details) <= 500),
  -- Snapshot so moderators can act even if the profile changes or is deleted.
  reported_username text,
  status            text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at        timestamptz not null default now()
);
create index reports_status_idx on reports(status, created_at);
create unique index reports_dedupe_uniq on reports(reporter_id, reported_user_id) where status = 'open';

create table moderation_actions (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid references reports(id) on delete set null,
  target_user_id  uuid references users(id) on delete set null,
  action          text not null check (action in ('dismiss', 'warn', 'suspend', 'unsuspend')),
  note            text,
  actor           text not null,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------------ billing & entitlements

-- Store-side subscription state (mirrors the purchase provider; display + audit).
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  provider               text not null check (provider in ('revenuecat')),
  product_id             text not null,
  store                  text not null,
  status                 text not null check (status in ('active', 'cancelled', 'in_grace', 'billing_issue', 'expired', 'refunded', 'paused')),
  entitlement            text not null,
  purchased_at           timestamptz,
  expires_at             timestamptz,
  will_renew             boolean not null default false,
  is_sandbox             boolean not null default false,
  management_url         text,
  updated_at             timestamptz not null default now(),
  unique (user_id, provider, product_id)
);

-- What the user is owed. Features are derived from active grants only.
create table entitlement_grants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  entitlement  text not null,
  source       text not null check (source in ('store', 'promo', 'admin')),
  source_ref   text not null,
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, source, source_ref)
);
create index entitlement_grants_user_idx on entitlement_grants(user_id);

-- Webhook idempotency + audit (payloads are not stored).
create table billing_events (
  id            text primary key,
  provider      text not null,
  type          text not null,
  app_user_id   text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);
