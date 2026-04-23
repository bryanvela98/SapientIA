import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sapientia.ui.debugOpen';

/**
 * Boolean state for the debug panel toggle, persisted across reloads in
 * localStorage. Falls back to `false` when storage is unavailable
 * (private mode, permission denied).
 */
export function useDebugOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      // private mode; ignore
    }
  }, [open]);

  return [open, setOpen];
}