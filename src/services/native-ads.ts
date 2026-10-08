import { Capacitor } from '@capacitor/core';
import { features } from './features';
import { t } from '../i18n';

// Deliberately demo-only: there is no production ad-unit configuration yet.
export const DEMO_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
let queue = Promise.resolve();
let wanted = false;
let active = false;
let initialized = false;
let status: 'loading' | 'loaded' | 'unavailable' = 'loading';
function paint() {
  const label = document.querySelector('.sponsor-slot > span');
  if (label)
    label.textContent = t(
      status === 'loaded'
        ? 'coaching.testAdLoaded'
        : status === 'unavailable'
          ? 'coaching.testAdUnavailable'
          : 'coaching.testAdLoading',
    );
}
export function syncNativeAds(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return Promise.resolve();
  wanted = features().ads;
  paint();
  queue = queue
    .then(async () => {
      if (!wanted && !initialized) return;
      const { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } =
        await import('@capacitor-community/admob');
      if (!wanted) {
        await AdMob.removeBanner();
        active = false;
        document.documentElement.style.setProperty('--native-ad-height', '0px');
        return;
      }
      if (!initialized) {
        await AdMob.addListener(
          BannerAdPluginEvents.SizeChanged,
          ({ height }) => {
            document.documentElement.style.setProperty(
              '--native-ad-height',
              wanted ? `${height}px` : '0px',
            );
          },
        );
        await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
          status = 'loaded';
          paint();
        });
        await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
          status = 'unavailable';
          active = false;
          document.documentElement.style.setProperty(
            '--native-ad-height',
            '0px',
          );
          paint();
        });
        await AdMob.initialize({ initializeForTesting: true });
        initialized = true;
      }
      if (!wanted || active) return;
      status = 'loading';
      paint();
      await AdMob.showBanner({
        adId: DEMO_BANNER_ID,
        adSize: BannerAdSize.BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting: true,
        npa: true,
      });
      active = true;
      if (!wanted) {
        await AdMob.removeBanner();
        active = false;
      }
    })
    .catch(() => {
      status = 'unavailable';
      active = false;
      document.documentElement.style.setProperty('--native-ad-height', '0px');
      paint();
    });
  return queue;
}
