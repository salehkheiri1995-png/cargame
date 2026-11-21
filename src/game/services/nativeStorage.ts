import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  BACKUP_KEY,
  PENDING_RACE_KEY,
  STORAGE_KEY,
  setStorageMirror,
} from './saveSystem';

const MIRRORED_KEYS = [STORAGE_KEY, BACKUP_KEY, PENDING_RACE_KEY] as const;

function readLastSavedAt(raw: string | null): number {
  if (!raw) return -1;
  try {
    const parsed = JSON.parse(raw) as { lastSavedAt?: unknown };
    return typeof parsed?.lastSavedAt === 'number' && Number.isFinite(parsed.lastSavedAt)
      ? parsed.lastSavedAt
      : 0;
  } catch {
    return -1;
  }
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota/permission problems are reported by the normal save pipeline.
  }
}

/**
 * Android WebView storage can be cleared by the system under pressure. The
 * durable Capacitor Preferences store is hydrated into localStorage before
 * React mounts, so every synchronous save path keeps working unchanged.
 *
 * The newer `lastSavedAt` wins when both stores hold a save; a corrupt local
 * copy never shadows a healthy mirrored one.
 */
export async function bootstrapNativeStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    for (const key of MIRRORED_KEYS) {
      const { value } = await Preferences.get({ key });
      if (!value) continue;
      const local = readLocal(key);
      if (!local) {
        writeLocal(key, value);
        continue;
      }
      if (key === STORAGE_KEY) {
        const localAt = readLastSavedAt(local);
        const mirrorAt = readLastSavedAt(value);
        if (mirrorAt > localAt) writeLocal(key, value);
      }
    }
  } catch {
    // Preferences unavailable: localStorage alone still works.
  }

  setStorageMirror((key, value) => {
    if (value === null) {
      void Preferences.remove({ key }).catch(() => undefined);
    } else {
      void Preferences.set({ key, value }).catch(() => undefined);
    }
  });
}
