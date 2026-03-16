// ============================================================
// FILE: .\frontend\src\hooks\useLanguage.ts
// ============================================================

import { useState, useCallback } from 'react';
import type { LangCode } from '../types';

const STORAGE_KEY = 'qa-language';

/**
 * Custom hook for managing interface language with localStorage persistence.
 */
export function useLanguage() {
  const [language, setLanguage] = useState<LangCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'pl') return stored;
    return 'pl';
  });

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => {
      const next = prev === 'pl' ? 'en' : 'pl';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setLang = useCallback((lang: LangCode) => {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  return { language, toggleLanguage, setLang };
}