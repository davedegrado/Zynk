import { AVATARS, AVATAR_COLORS, isAvatarColor, isAvatarId, type Me, type PublicUser } from '@zynk/shared';
import { randomInt } from 'node:crypto';
import { ApiError } from '../../lib/errors';

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_id: string;
  avatar_color: string;
  invite_code?: string;
  created_at?: Date;
  status?: string;
}

/** Columns safe to select for building a PublicUser. */
export const PUBLIC_USER_COLS = 'u.id, u.username, u.display_name, u.avatar_id, u.avatar_color';
/** Columns for building Me (own account). */
export const ME_COLS = 'id, username, display_name, avatar_id, avatar_color, invite_code, created_at';

export function toPublicUser(r: UserRow): PublicUser {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatar: { id: r.avatar_id, color: r.avatar_color },
  };
}

export function toMe(r: UserRow): Me {
  return { ...toPublicUser(r), createdAt: r.created_at!.toISOString(), inviteCode: r.invite_code! };
}

/** Prefix a public-user column list for a given alias and output prefix, e.g. ("s", "sender_"). */
export function publicCols(alias: string, prefix: string): string {
  return ['id', 'username', 'display_name', 'avatar_id', 'avatar_color']
    .map((c) => `${alias}.${c} as ${prefix}${c}`)
    .join(', ');
}

export function pickPublic(row: Record<string, unknown>, prefix: string): PublicUser {
  return toPublicUser({
    id: row[`${prefix}id`] as string,
    username: row[`${prefix}username`] as string,
    display_name: row[`${prefix}display_name`] as string,
    avatar_id: row[`${prefix}avatar_id`] as string,
    avatar_color: row[`${prefix}avatar_color`] as string,
  });
}

/** Validates an avatar choice against the catalog (avatars are free for everyone). */
export function assertAvatar(a: { id: string; color: string }) {
  if (!isAvatarId(a.id)) throw new ApiError('unknown_item', 'Unknown avatar', { fields: { avatar: 'Unknown avatar' } });
  if (!isAvatarColor(a.color)) throw new ApiError('unknown_item', 'Unknown avatar color', { fields: { avatar: 'Unknown color' } });
}

export function randomAvatar() {
  return { id: AVATARS[randomInt(AVATARS.length)]!, color: AVATAR_COLORS[randomInt(AVATAR_COLORS.length)]!.id };
}
