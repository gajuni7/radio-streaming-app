import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.undeco.radioonline',
  appName: 'Undeco RadioOnline',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a2e'
    }
  }
};

export default config;
