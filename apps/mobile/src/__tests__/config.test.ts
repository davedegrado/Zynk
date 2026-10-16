jest.mock('expo-secure-store', () => ({}));

import { normalizeServerUrl } from '../lib/config';

describe('server address (test builds)', () => {
  it('turns a bare LAN IP into a full URL on port 4000', () => {
    expect(normalizeServerUrl(' 192.168.1.20 ')).toBe('http://192.168.1.20:4000');
    expect(normalizeServerUrl('192.168.1.20/')).toBe('http://192.168.1.20:4000');
  });
  it('keeps explicit schemes, ports and hostnames', () => {
    expect(normalizeServerUrl('http://192.168.1.20:8080')).toBe('http://192.168.1.20:8080');
    expect(normalizeServerUrl('https://api.example.com')).toBe('https://api.example.com');
    expect(normalizeServerUrl('my-pc.local:4000')).toBe('http://my-pc.local:4000');
  });
  it('rejects empty input', () => {
    expect(normalizeServerUrl('   ')).toBeNull();
  });
});
