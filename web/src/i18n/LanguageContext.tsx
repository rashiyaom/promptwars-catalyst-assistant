import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { hindi } from './messages.js';

export type Language = 'en' | 'hi';
type Translate = (english: string, ...values: readonly (string | number)[]) => string;

/** Translate product copy, inserting values once without altering user-entered care data. */
export function translate(
  language: Language,
  english: string,
  ...values: readonly (string | number)[]
): string {
  const message = language === 'hi' ? (hindi[english] ?? english) : english;
  return message.replace(/\{(\d+)\}/g, (placeholder: string, index: string) =>
    String(values[Number(index)] ?? placeholder),
  );
}

interface LanguageValue {
  language: Language;
  locale: 'en-IN' | 'hi-IN';
  setLanguage: (language: Language) => void;
  t: Translate;
}
const LanguageContext = createContext<LanguageValue>({
  language: 'en',
  locale: 'en-IN',
  setLanguage: () => undefined,
  t: (message, ...values) => translate('en', message, ...values),
});

/** Small offline language provider; denied storage never prevents using the website. */
export function LanguageProvider({
  children,
  initialLanguage,
}: {
  readonly children: React.ReactNode;
  readonly initialLanguage?: Language;
}): React.JSX.Element {
  const [language, setLanguage] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    try {
      return typeof window !== 'undefined' &&
        window.localStorage.getItem('sanjeevani:language') === 'hi'
        ? 'hi'
        : 'en';
    } catch {
      return 'en';
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === 'hi' ? 'संजीवनी — अपनों की देखभाल' : 'Sanjeevani — Care that feels like family';
    try {
      window.localStorage.setItem('sanjeevani:language', language);
    } catch {
      /* Keep the selection for this session. */
    }
  }, [language]);
  const value = useMemo<LanguageValue>(
    () => ({
      language,
      locale: language === 'hi' ? 'hi-IN' : 'en-IN',
      setLanguage,
      t: (message, ...values) => translate(language, message, ...values),
    }),
    [language],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Access the current language without adding an internationalization dependency. */
export function useLanguage(): LanguageValue {
  return useContext(LanguageContext);
}
