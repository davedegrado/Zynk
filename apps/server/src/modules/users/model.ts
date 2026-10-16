import type { Me, PublicUser } from '@zynk/shared';

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_version: number;
  avatar_mime?: string | null;
  invite_code?: string;
  created_at?: Date;
  status?: string;
}

/** Columns safe to select for building a PublicUser. */
export const PUBLIC_USER_COLS = 'u.id, u.username, u.display_name, u.avatar_version, u.avatar_mime';

export function toPublicUser(r: UserRow): PublicUser {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_mime ? `/avatars/${r.id}?v=${r.avatar_version}` : null,
  };
}

export function toMe(r: UserRow): Me {
  return { ...toPublicUser(r), createdAt: r.created_at!.toISOString(), inviteCode: r.invite_code! };
}

/** Prefix a public-user column list for a given alias and output prefix, e.g. ("s", "sender_"). */
export function publicCols(alias: string, prefix: string): string {
  return ['id', 'username', 'display_name', 'avatar_version', 'avatar_mime']
    .map((c) => `${alias}.${c} as ${prefix}${c}`)
    .join(', ');
}

export function pickPublic(row: Record<string, unknown>, prefix: string): PublicUser {
  return toPublicUser({
    id: row[`${prefix}id`] as string,
    username: row[`${prefix}username`] as string,
    display_name: row[`${prefix}display_name`] as string,
    avatar_version: row[`${prefix}avatar_version`] as number,
    avatar_mime: row[`${prefix}avatar_mime`] as string | null,
  });
}
