/** Transport-agnostic push interface. The default implementation uses Expo's push service (FCM + APNs). */
export interface PushMessage {
  to: string;
  platform: 'ios' | 'android';
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** iOS: bundled sound file name (e.g. "zynk_boing.wav") or null for silent. */
  iosSound: string | null;
  /** Android: notification channel id (sound is bound to the channel on Android 8+). */
  androidChannelId: string;
  badge?: number;
}

export type PushResult =
  | { ok: true; ticketId?: string }
  | { ok: false; error: string; deviceGone: boolean };

export interface PushProvider {
  readonly name: string;
  send(messages: PushMessage[]): Promise<PushResult[]>;
  /** Returns ticket ids whose devices are no longer registered. */
  checkReceipts?(ticketIds: string[]): Promise<{ deadTicketIds: string[] }>;
}

export class LogPushProvider implements PushProvider {
  readonly name = 'log';
  readonly sent: PushMessage[] = [];
  constructor(private readonly log: (msg: object) => void = () => undefined) {}
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const m of messages) {
      this.sent.push(m);
      // Never log tokens.
      this.log({ event: 'push_log_provider', platform: m.platform, title: m.title, channel: m.androidChannelId });
    }
    return messages.map(() => ({ ok: true }));
  }
}

export class NoopPushProvider implements PushProvider {
  readonly name = 'none';
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    return messages.map(() => ({ ok: false, error: 'push_disabled', deviceGone: false }));
  }
}
