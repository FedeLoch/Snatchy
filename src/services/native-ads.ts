import { Capacitor } from '@capacitor/core';
import { features } from './features';
import { t } from '../i18n';

/** Google's sample banner unit; used whenever no production unit is set. */
export const DEMO_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
/** Production builds set VITE_ADMOB_BANNER_ID (see docs/PUBLISHING.md).
 * Without it the app keeps serving Google test ads, so a development build
 * can never request live ads by accident. */
export function adConfig(
  bannerId: string | undefined = import.meta.env.VITE_ADMOB_BANNER_ID,
) {
  const live = !!bannerId && /^ca-app-pub-\d+\/\d+$/.test(bannerId);
  return { bannerId: live ? bannerId! : DEMO_BANNER_ID, testing: !live };
}
let privacyOptions = false;
/** Whether Google's consent SDK asks for an "ad privacy choices" entry
 * point (EEA/UK users must be able to change their consent later). */
export const adPrivacyOptionsRequired = () => privacyOptions;
export async function showAdPrivacyOptions(): Promise<void> {
  const { AdMob } = await import('@capacitor-community/admob');
  await AdMob.showPrivacyOptionsForm();
}
let queue = Promise.resolve();
let wanted = false;
let active = false;
let initialized = false;
let listening = false;
let status: 'loading' | 'loaded' | 'unavailable' = 'loading';
function paint() {
  const label = document.querySelector('.sponsor-slot > span');
  if (!label) return;
  const test = adConfig().testing;
  label.textContent = t(
    status === 'loaded'
      ? test
        ? 'coaching.testAdLoaded'
        : 'coaching.adLoaded'
      : status === 'unavailable'
        ? test
          ? 'coaching.testAdUnavailable'
          : 'coaching.adUnavailable'
        : test
          ? 'coaching.testAdLoading'
          : 'coaching.adLoading',
  );
}
export function syncNativeAds(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return Promise.resolve();
  wanted = features().ads;
  paint();
  queue = queue
    .then(async () => {
      if (!wanted && !initialized) return;
      const {
        AdMob,
        AdmobConsentStatus,
        BannerAdSize,
        BannerAdPosition,
        BannerAdPluginEvents,
      } = await import('@capacitor-community/admob');
      const config = adConfig();
      if (!wanted) {
        await AdMob.removeBanner();
        active = false;
        document.documentElement.style.setProperty('--native-ad-height', '0px');
        return;
      }
      if (!listening) {
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
        listening = true;
      }
      if (!initialized) {
        // Google's consent flow (UMP) runs before the SDK may request ads:
        // EEA/UK users see the consent form; elsewhere it is not required.
        let consent = await AdMob.requestConsentInfo();
        if (
          consent.isConsentFormAvailable &&
          consent.status === AdmobConsentStatus.REQUIRED
        )
          consent = await AdMob.showConsentForm();
        privacyOptions = consent.privacyOptionsRequirementStatus === 'REQUIRED';
        if (!consent.canRequestAds) throw new Error('Ad consent not given');
        await AdMob.initialize({ initializeForTesting: config.testing });
        initialized = true;
      }
      if (!wanted || active) return;
      status = 'loading';
      paint();
      await AdMob.showBanner({
        adId: config.bannerId,
        adSize: BannerAdSize.BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting: config.testing,
        // Non-personalised ads only, in keeping with the local-first design.
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
