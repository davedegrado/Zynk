import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from './config';
import type { Db } from './db/pool';
import type { PushDispatcher } from './modules/push/dispatcher';
import type { BillingProvider } from './modules/billing/provider';

export interface AppContext {
  config: Config;
  db: Db;
  push: PushDispatcher;
  /** null when no purchase provider is configured — the app keeps working for free users. */
  billing: BillingProvider | null;
  now: () => Date;
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: { userId: string; sessionId: string };
  }
}

export function authOf(req: FastifyRequest): { userId: string; sessionId: string } {
  if (!req.auth) throw new Error('route is missing requireAuth');
  return req.auth;
}
