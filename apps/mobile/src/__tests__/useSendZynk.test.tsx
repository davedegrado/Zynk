import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockSendZynk = jest.fn();
jest.mock('../lib/api', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    retryAfterMs?: number;
    constructor(status: number, code: string, message: string, retryAfterMs?: number) {
      super(message);
      this.status = status;
      this.code = code;
      this.retryAfterMs = retryAfterMs;
    }
  }
  return { ApiError, api: { sendZynk: (...a: unknown[]) => mockSendZynk(...a) } };
});
jest.mock('../lib/hooks', () => ({ useEffectivePrefs: () => ({ haptics: true, soundsEnabled: false, outgoingSoundId: 'zynk_classic' }) }));
jest.mock('../lib/haptics', () => ({ haptic: { zynk: jest.fn(), warn: jest.fn(), tap: jest.fn() } }));
jest.mock('../lib/sounds', () => ({ playSound: jest.fn() }));
jest.mock('../components/ui', () => ({ useToast: () => () => undefined }));
let mockN = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockN).padStart(12, '0')}` }));

import { ApiError } from '../lib/api';
import { queryClient } from '../lib/query';
import { useSendZynk } from '../components/zynk/useSendZynk';

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
const ok = (id = 'z1') => ({ zynk: { id, createdAt: new Date().toISOString() }, duplicate: false });

// Infinite gcTime: react-query schedules no garbage-collection timers, so Jest can exit.
queryClient.setDefaultOptions({ queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } });
beforeEach(() => mockSendZynk.mockReset());

it('ignores rapid repeated taps while a Speow is in flight', async () => {
  let resolve!: (v: unknown) => void;
  mockSendZynk.mockImplementation(() => new Promise((r) => (resolve = r)));
  const { result } = await renderHook(() => useSendZynk('friend-1'), { wrapper });
  let accepted: boolean[] = [];
  await act(async () => {
    accepted = [result.current.send(null), result.current.send(null), result.current.send(null)];
  });
  expect(accepted).toEqual([true, false, false]);
  await act(async () => resolve(ok()));
  await waitFor(() => expect(result.current.sending).toBe(false));
  expect(mockSendZynk).toHaveBeenCalledTimes(1);
});

it('retries a network failure once with the SAME idempotency nonce', async () => {
  mockSendZynk.mockRejectedValueOnce(new ApiError(0, 'network', 'offline')).mockResolvedValueOnce(ok());
  const { result } = await renderHook(() => useSendZynk('friend-1'), { wrapper });
  await act(async () => {
    result.current.send('basic:fire');
  });
  await waitFor(() => expect(mockSendZynk).toHaveBeenCalledTimes(2));
  const [first, second] = mockSendZynk.mock.calls.map((c) => c[0]);
  expect(first.clientNonce).toBe(second.clientNonce);
  expect(first).toMatchObject({ recipientId: 'friend-1', reactionId: 'basic:fire' });
});

it('respects a server cooldown before allowing the next send', async () => {
  mockSendZynk.mockRejectedValueOnce(new ApiError(429, 'cooldown', 'Easy there!', 60_000));
  const { result } = await renderHook(() => useSendZynk('friend-1'), { wrapper });
  await act(async () => {
    result.current.send(null);
  });
  await waitFor(() => expect(result.current.cooldownUntil).toBeGreaterThan(Date.now()));
  let again = true;
  await act(async () => {
    again = result.current.send(null);
  });
  expect(again).toBe(false);
  expect(mockSendZynk).toHaveBeenCalledTimes(1);
});

afterAll(() => {
  queryClient.clear();
});
