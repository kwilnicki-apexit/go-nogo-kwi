// ============================================================
// FILE: .\frontend\src\hooks\useUserConfig.ts
// ============================================================

import { useState, useCallback } from "react";
import type { UserConfig } from "../types";

const STORAGE_KEY = "qa-user-config";

const DEFAULT_CONFIG: UserConfig = {
  displayName: "Jan Developer",
  role: "QA Engineer",
  authorName: "Jan Developer",
};

/**
 * Custom hook for managing user configuration with localStorage persistence.
 */
export function useUserConfig() {
  const [userConfig, setUserConfig] = useState<UserConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // Fall through to default
    }
    return DEFAULT_CONFIG;
  });

  const updateUserConfig = useCallback((updates: Partial<UserConfig>) => {
    setUserConfig((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { userConfig, updateUserConfig };
}
