import { useState, useCallback } from 'react';

/**
 * Custom hook to manage persistent sidebar collapsed state.
 *
 * @param {string} storageKey - Unique localStorage key (e.g., 'convia_sidebar_main_collapsed')
 * @param {boolean} defaultCollapsed - Initial collapsed state if no stored preference exists (default: false)
 * @returns {[boolean, () => void, (val: boolean | ((prev: boolean) => boolean)) => void]} [isCollapsed, toggleCollapse, setIsCollapsed]
 */
export function useSidebarCollapse(storageKey, defaultCollapsed = false) {
  const [isCollapsed, setIsCollapsedState] = useState(() => {
    if (typeof window === 'undefined' || !storageKey) {
      return defaultCollapsed;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // Safe fallback if localStorage is blocked (e.g., restricted iframe or private browsing)
    }
    return defaultCollapsed;
  });

  const setIsCollapsed = useCallback(
    (value) => {
      setIsCollapsedState((prev) => {
        const next = typeof value === 'function' ? value(prev) : Boolean(value);
        if (typeof window !== 'undefined' && storageKey) {
          try {
            window.localStorage.setItem(storageKey, String(next));
          } catch {
            // Silently catch quota or privacy errors
          }
        }
        return next;
      });
    },
    [storageKey]
  );

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, [setIsCollapsed]);

  return [isCollapsed, toggleCollapse, setIsCollapsed];
}
