import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * One haptics entry point for web + Android.
 *
 * The player setting is respected everywhere, and a missing plugin / denied
 * permission is never allowed to throw into a pointer handler. Native builds
 * use Capacitor Haptics; browsers fall back to `navigator.vibrate`.
 */
let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export type HapticStrength = 'light' | 'medium' | 'heavy';

const IMPACT: Record<HapticStrength, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

export async function hapticImpact(strength: HapticStrength = 'light'): Promise<void> {
  if (!hapticsEnabled || isHidden()) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: IMPACT[strength] });
    } catch {
      // Device without a vibrator, or the user disabled system haptics.
    }
    return;
  }
  vibrateFallback(strength === 'heavy' ? 24 : strength === 'medium' ? 14 : 8);
}

export async function hapticNotification(
  type: 'success' | 'warning' | 'error' = 'success'
): Promise<void> {
  if (!hapticsEnabled || isHidden()) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const map = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      } as const;
      await Haptics.notification({ type: map[type] });
    } catch {
      // Ignore unsupported devices.
    }
    return;
  }
  vibrateFallback(type === 'success' ? 12 : 30);
}

function vibrateFallback(ms: number): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(ms);
  } catch {
    // Unsupported browser.
  }
}
