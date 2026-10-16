jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('expo-secure-store', () => ({}));

import { urlToPath } from '../lib/notifications';

describe('push deep links', () => {
  it('maps known zynk:// URLs to routes', () => {
    expect(urlToPath('zynk://activity?zynk=4f8e5a1c-0000-4000-8000-000000000001')).toBe('/activity?zynk=4f8e5a1c-0000-4000-8000-000000000001');
    expect(urlToPath('zynk://user/4f8e5a1c-0000-4000-8000-000000000001')).toBe('/user/4f8e5a1c-0000-4000-8000-000000000001');
    expect(urlToPath('zynk://add')).toBe('/add');
    expect(urlToPath('zynk://invite/AbCdEf2345')).toBe('/invite/AbCdEf2345');
  });

  it('rejects anything else', () => {
    for (const bad of [undefined, '', 'https://evil.example', 'zynk://settings/account', 'zynk://user/../../x', 'javascript:alert(1)', 'zynk://activity?x=<script>']) {
      expect(urlToPath(bad)).toBeNull();
    }
  });
});
