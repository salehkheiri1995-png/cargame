import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();
export const platformName = (): string => Capacitor.getPlatform();

/**
 * Native chrome is configured in TypeScript so the same `dist/` bundle keeps
 * working in a plain browser: every call is guarded by `isNativePlatform()`.
 */
export async function initNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#020617' });
  } catch {
    // iOS / unsupported status bar.
  }
  try {
    await SplashScreen.hide();
  } catch {
    // Splash already hidden or plugin missing.
  }
}

/**
 * Android hardware Back. The handler returns `true` when it consumed the press.
 * Returning `false` at the root screen means "leave the app", but the caller is
 * expected to show a confirmation first, so accidental exits are avoided.
 */
export function registerBackHandler(handler: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  let disposed = false;
  const listener = CapacitorApp.addListener('backButton', () => {
    if (disposed) return;
    const handled = handler();
    if (!handled) void exitApp();
  });
  return () => {
    disposed = true;
    void listener.then((handle) => handle.remove()).catch(() => undefined);
  };
}

export async function exitApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorApp.exitApp();
  } catch {
    // Ignore; the OS will close the task on the next Back.
  }
}

/** Fires when the app goes to background or comes back to the foreground. */
export function registerAppStateHandler(handler: (active: boolean) => void): () => void {
  let disposed = false;
  // The App plugin also has a web implementation backed by visibilitychange.
  const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (disposed) return;
    handler(isActive);
  });
  return () => {
    disposed = true;
    void listener.then((handle) => handle.remove()).catch(() => undefined);
  };
}
