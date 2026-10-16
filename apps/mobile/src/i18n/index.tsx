import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '@zynk/shared';
import { tokenStorage } from '../lib/storage';
import { en, type MessageKey } from './en';
import { it } from './it';

export type LanguageChoice = 'system' | Language;
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', it: 'Italiano' };

const DICTS: Record<Language, Record<MessageKey, string>> = { en, it };
const STORAGE_KEY = 'speow.language';

export function deviceLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === 'it' ? 'it' : 'en';
  } catch {
    return 'en';
  }
}

const resolve = (c: LanguageChoice): Language => (c === 'system' ? deviceLanguage() : c);

/** Module-level copy for code outside React; updated whenever the choice changes. */
let current: Language = deviceLanguage();
export const getLanguage = () => current;

export type Vars = Record<string, string | number>;

function format(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Translate outside React (libs, toasts built in callbacks). */
export function translate(key: MessageKey, vars?: Vars): string {
  return format(DICTS[current][key] ?? en[key] ?? key, vars);
}

/** Translate a dynamic key (e.g. catalog items), with an English fallback string. */
export function translateDynamic(key: string, fallback: string, vars?: Vars): string {
  const dict = DICTS[current] as Record<string, string>;
  return format(dict[key] ?? (en as Record<string, string>)[key] ?? fallback, vars);
}

interface I18nValue {
  lang: Language;
  choice: LanguageChoice;
  setChoice: (c: LanguageChoice) => Promise<void>;
  t: (key: MessageKey, vars?: Vars) => string;
  td: (key: string, fallback: string, vars?: Vars) => string;
  /** BCP-47 locale for dates. */
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<LanguageChoice>('system');
  const lang = resolve(choice);

  useEffect(() => {
    tokenStorage
      .get(STORAGE_KEY)
      .then((v) => {
        if (v === 'en' || v === 'it' || v === 'system') {
          current = resolve(v);
          setChoiceState(v);
        }
      })
      .catch(() => undefined);
  }, []);

  const setChoice = useCallback(async (c: LanguageChoice) => {
    current = resolve(c);
    setChoiceState(c);
    await tokenStorage.set(STORAGE_KEY, c).catch(() => undefined);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      choice,
      setChoice,
      t: (key, vars) => format(DICTS[lang][key] ?? en[key] ?? key, vars),
      td: (key, fallback, vars) => format((DICTS[lang] as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? fallback, vars),
      locale: lang === 'it' ? 'it-IT' : 'en-GB',
    }),
    [lang, choice, setChoice],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallback: I18nValue = {
  get lang() {
    return current;
  },
  choice: 'system',
  setChoice: async () => undefined,
  t: translate,
  td: translateDynamic,
  get locale() {
    return current === 'it' ? 'it-IT' : 'en-GB';
  },
};

/** Outside the provider (isolated component tests) this falls back to the module-level language. */
export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? fallback;
}

export type { MessageKey };
