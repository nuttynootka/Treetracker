import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nuttynootka.treetracker',
  appName: 'TreeTracker',
  webDir: 'dist',
  plugins: {
    // Edge to edge: the page pads itself using the inset values (see theme.css). LIGHT = dark icons
    // on the light grey, whatever the phone's dark-mode setting.
    SystemBars: { insetsHandling: 'css', style: 'LIGHT', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
