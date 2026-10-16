const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Registers the SMS Retriever BroadcastReceiver.
 * This does NOT add READ_SMS / RECEIVE_SMS permissions — the receiver
 * only receives the special SMS sent with the app's 11-char hash,
 * which is why Google Play allows this without special permission.
 */
const withSmsRetrieverReceiver = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    app.receiver = app.receiver || [];
    const receiverName = "com.pushpendersingh.otpverify.SmsBroadcastReceiver";

    if (!app.receiver.some((r) => r.$["android:name"] === receiverName)) {
      app.receiver.push({
        $: {
          "android:name": receiverName,
          "android:enabled": "true",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "com.google.android.gms.auth.api.phone.SMS_RETRIEVED",
                },
              },
            ],
          },
        ],
      });
    }
    return config;
  });

module.exports = (config) => {
  config = withSmsRetrieverReceiver(config);
  return config;
};