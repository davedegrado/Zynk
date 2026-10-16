/**
 * Texts generated on the server (push notifications) in every supported
 * language, plus localized Speow color names shared with the app.
 */
import type { Language } from './api';

export const COLOR_NAMES: Record<Language, Record<string, string>> = {
  en: { lime: 'lime', purple: 'purple', blue: 'blue', pink: 'pink', tangerine: 'orange', cloud: 'white', ink: 'black' },
  it: { lime: 'lime', purple: 'viola', blue: 'blu', pink: 'rosa', tangerine: 'arancione', cloud: 'bianco', ink: 'nero' },
};

export function colorName(lang: Language, colorId: string | null | undefined): string | null {
  return (colorId && COLOR_NAMES[lang][colorId]) || null;
}

export const PUSH_COPY: Record<
  Language,
  {
    speowTitle: string;
    speowBody: (name: string, color: string | null, glyph: string | null) => string;
    requestTitle: string;
    requestBody: (name: string) => string;
    acceptedTitle: string;
    acceptedBody: (name: string) => string;
  }
> = {
  en: {
    speowTitle: 'Speow!',
    speowBody: (name, color, glyph) => `${name} sent you ${color ? `a ${color} Speow` : 'a Speow'}${glyph ? ` ${glyph}` : '!'}`,
    requestTitle: 'New friend request',
    requestBody: (name) => `${name} wants to be friends on Speow!`,
    acceptedTitle: 'You have a new friend',
    acceptedBody: (name) => `${name} accepted your request. Send a Speow!`,
  },
  it: {
    speowTitle: 'Speow!',
    // "uno Speow" (S + consonant) — color follows the noun in Italian.
    speowBody: (name, color, glyph) => `${name} ti ha mandato uno Speow${color ? ` ${color}` : ''}${glyph ? ` ${glyph}` : '!'}`,
    requestTitle: 'Nuova richiesta di amicizia',
    requestBody: (name) => `${name} vuole essere tuo amico su Speow!`,
    acceptedTitle: 'Hai un nuovo amico',
    acceptedBody: (name) => `${name} ha accettato la tua richiesta. Mandagli uno Speow!`,
  },
};
