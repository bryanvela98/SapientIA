const KEY = 'sapientia.learnerId';

export const getCachedLearnerId = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const setCachedLearnerId = (id: string): void => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // localStorage may be unavailable (private mode); degrade silently.
  }
};

export const clearCachedLearnerId = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // no-op
  }
};