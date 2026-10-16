jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: '1',
    PAYMENT_PENDING_ERROR: '20',
    PRODUCT_ALREADY_PURCHASED_ERROR: '6',
    NETWORK_ERROR: '10',
    PURCHASE_NOT_ALLOWED_ERROR: '3',
  },
}));
jest.mock('expo-secure-store', () => ({}));

import { mapError } from '../lib/purchases';

describe('purchase error handling', () => {
  it('treats cancellation silently and pending purchases as pending (never as unlocked)', () => {
    expect(mapError({ userCancelled: true })).toEqual({ kind: 'cancelled' });
    expect(mapError({ code: '1' })).toEqual({ kind: 'cancelled' });
    expect(mapError({ code: '20' })).toEqual({ kind: 'pending' });
  });

  it('gives actionable messages for common failures', () => {
    expect(mapError({ code: '6' })).toMatchObject({ kind: 'error', message: expect.stringContaining('Restore') });
    expect(mapError({ code: '10' })).toMatchObject({ kind: 'error' });
    expect(mapError(new Error('boom'))).toEqual({ kind: 'error', message: 'boom' });
  });
});
