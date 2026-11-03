import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.fieldtracker',
  appName: 'Field Tracker',
  webDir: 'www',
  appendUserAgent: ' FieldTracker/1.0 (https://github.com/aaronmarayaa/field-tracker)',
  android: {
    // Required by the location plugin to deliver updates after the app is backgrounded.
    useLegacyBridge: true,
  },
};

export default config;
