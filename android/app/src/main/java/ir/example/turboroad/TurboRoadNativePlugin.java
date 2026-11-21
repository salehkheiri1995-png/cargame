package ir.example.turboroad;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Local Capacitor plugin exposing the native monetization bridge to the web
 * layer (see src/game/services/providers.ts → `NativeBridge`).
 *
 * SAFETY CONTRACT
 * ------------------------------------------------
 * This plugin NEVER fabricates a completed ad or a verified purchase. Until a
 * real store SDK (Cafe Bazaar / Myket / Google Play) and a server-side receipt
 * validator are wired, every method returns an explicitly `unavailable` (or
 * `failed`/`not-implemented`) outcome so no reward can leak.
 *
 * Wiring TODO (requires real developer accounts + SDKs):
 *  1. Add the chosen SDK dependency in android/app/build.gradle
 *     (e.g. com.github.cafebazaar:Poolakey, Myket, or Google Play Billing).
 *  2. In `purchase`, start the store flow, receive the server-verified receipt,
 *     then return it under `receiptToken` + `verification:"server"` +
 *     `transactionId`.
 *  3. In `showRewarded`/`showInterstitial`, load the ad via the chosen network
 *     (Tapsell / AdMob) and only return `completed` (+ `rewardToken`) when the
 *     SDK reports a genuine completion.
 *  4. Never fall back to a local-only flag; always go through the store/SDK.
 */
@CapacitorPlugin(name = "TurboRoadNative")
public class TurboRoadNativePlugin extends Plugin {

    private JSObject unavailable(String method) {
        JSObject out = new JSObject();
        out.put("status", "unavailable");
        out.put("errorCode", "not-implemented:" + method);
        return out;
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        call.resolve(unavailable("purchase"));
    }

    @PluginMethod
    public void restore(PluginCall call) {
        JSObject out = new JSObject();
        out.put("status", "unavailable");
        out.put("entitlements", new com.getcapacitor.JSArray());
        out.put("errorCode", "not-implemented:restore");
        call.resolve(out);
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        call.resolve(unavailable("showRewarded"));
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        call.resolve(unavailable("showInterstitial"));
    }
}
