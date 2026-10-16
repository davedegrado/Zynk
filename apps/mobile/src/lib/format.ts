import { getLanguage, translate } from '../i18n';

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 10) return translate('time.justNow');
  if (s < 60) return translate('time.seconds', { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return translate('time.minutes', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return translate('time.hours', { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return translate('time.days', { n: d });
  return formatDate(iso, { day: 'numeric', month: 'short' });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString(getLanguage() === 'it' ? 'it-IT' : 'en-GB', opts);
}

export function periodLabel(period: 'P1M' | 'P1Y') {
  return translate(period === 'P1M' ? 'plus.perMonth' : 'plus.perYear');
}
