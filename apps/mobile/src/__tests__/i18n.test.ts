import { en } from '../i18n/en';
import { it as itDict } from '../i18n/it';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

it('Italian covers every English key with the same placeholders', () => {
  expect(Object.keys(itDict).sort()).toEqual(Object.keys(en).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    expect(itDict[key].length).toBeGreaterThan(0);
    expect([key, placeholders(itDict[key])]).toEqual([key, placeholders(en[key])]);
  }
});
