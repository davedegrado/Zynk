/** Invite code opened while signed out; consumed right after sign-in. */
let pending: string | null = null;
export const pendingInvite = {
  set: (code: string) => {
    pending = code;
  },
  take: () => {
    const c = pending;
    pending = null;
    return c;
  },
};
