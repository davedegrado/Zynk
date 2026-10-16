import type { PushMessage, PushProvider, PushResult } from './provider';

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

type Ticket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

/**
 * Expo Push Service client (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Expo relays to FCM (Android) and APNs (iOS) using the credentials uploaded to EAS.
 */
export class ExpoPushProvider implements PushProvider {
  readonly name = 'expo';
  constructor(
    private readonly accessToken?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers() {
    const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (this.accessToken) h.authorization = `Bearer ${this.accessToken}`;
    return h;
  }

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const body = chunk.map((m) => ({
        to: m.to,
        title: m.title,
        body: m.body,
        data: m.data,
        priority: 'high',
        sound: m.platform === 'ios' ? m.iosSound : undefined,
        channelId: m.platform === 'android' ? m.androidChannelId : undefined,
        badge: m.badge,
        categoryId: 'zynk',
      }));
      try {
        const res = await this.fetchImpl(SEND_URL, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
        if (!res.ok) {
          chunk.forEach(() => results.push({ ok: false, error: `http_${res.status}`, deviceGone: false }));
          continue;
        }
        const json = (await res.json()) as { data?: Ticket[] };
        chunk.forEach((_, j) => {
          const t = json.data?.[j];
          if (t?.status === 'ok') results.push({ ok: true, ticketId: t.id });
          else {
            const code = t?.details?.error ?? 'unknown';
            results.push({ ok: false, error: code, deviceGone: code === 'DeviceNotRegistered' });
          }
        });
      } catch {
        chunk.forEach(() => results.push({ ok: false, error: 'network', deviceGone: false }));
      }
    }
    return results;
  }

  async checkReceipts(ticketIds: string[]): Promise<{ deadTicketIds: string[] }> {
    const dead: string[] = [];
    for (let i = 0; i < ticketIds.length; i += 300) {
      const ids = ticketIds.slice(i, i + 300);
      const res = await this.fetchImpl(RECEIPTS_URL, { method: 'POST', headers: this.headers(), body: JSON.stringify({ ids }) });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: Record<string, Ticket> };
      for (const [id, r] of Object.entries(json.data ?? {})) {
        if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') dead.push(id);
      }
    }
    return { deadTicketIds: dead };
  }
}
