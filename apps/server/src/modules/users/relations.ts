import type { Queryable } from '../../db/pool';

export const orderPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export async function areFriends(db: Queryable, a: string, b: string): Promise<boolean> {
  const [x, y] = orderPair(a, b);
  const { rowCount } = await db.query('select 1 from friendships where user_a = $1 and user_b = $2', [x, y]);
  return (rowCount ?? 0) > 0;
}

/** True if either user blocked the other. */
export async function isBlockedEitherWay(db: Queryable, a: string, b: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `select 1 from blocks where (blocker_id = $1 and blocked_id = $2) or (blocker_id = $2 and blocked_id = $1)`,
    [a, b],
  );
  return (rowCount ?? 0) > 0;
}

/** SQL predicate: no block in either direction between $viewer and the user column. */
export const notBlockedSql = (viewerParam: string, userCol: string) =>
  `not exists (select 1 from blocks b where (b.blocker_id = ${viewerParam} and b.blocked_id = ${userCol})
                                          or (b.blocker_id = ${userCol} and b.blocked_id = ${viewerParam}))`;
