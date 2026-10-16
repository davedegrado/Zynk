-- Speow! avatars replace uploaded profile photos; per-user language for server texts.

alter table users
  add column avatar_id    text not null default 'cat',
  add column avatar_color text not null default 'lime';

-- Give existing accounts a varied starting avatar.
update users set
  avatar_id = (array['cat','alien','robot','ghost','frog','bear','bunny','blob','dino','owl','fox','monster'])[1 + (abs(hashtext(id::text)) % 12)],
  avatar_color = (array['lime','purple','blue','pink','tangerine','cloud','ink'])[1 + (abs(hashtext(id::text || 'c')) % 7)];

-- Photos are no longer supported: delete them (data minimization).
alter table users
  drop column avatar,
  drop column avatar_mime,
  drop column avatar_version;

alter table preferences
  add column language text not null default 'en' check (language in ('en', 'it'));
