import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  ads: true,
  platform: 'android',
  initialize: vi.fn(),
  showBanner: vi.fn(),
  removeBanner: vi.fn(),
  addListener: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => state.platform },
}));
vi.mock('../../src/services/features', () => ({
  features: () => ({ ads: state.ads }),
}));
vi.mock('@capacitor-community/admob', () => ({
  AdMob: state,
  BannerAdSize: { BANNER: 'BANNER' },
  BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
  BannerAdPluginEvents: {
    Loaded: 'loaded',
    FailedToLoad: 'failed',
    SizeChanged: 'size',
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.ads = true;
  state.platform = 'android';
  state.initialize.mockResolvedValue(undefined);
  state.showBanner.mockResolvedValue(undefined);
  state.removeBanner.mockResolvedValue(undefined);
  state.addListener.mockResolvedValue({ remove: vi.fn() });
  document.body.innerHTML = '<div class="sponsor-slot"><span></span></div>';
});
it('does not initialize ads on the web or when initially disabled', async () => {
  const { syncNativeAds } = await import('../../src/services/native-ads');
  state.platform = 'web';
  await syncNativeAds();
  state.platform = 'android';
  state.ads = false;
  await syncNativeAds();
  expect(state.initialize).not.toHaveBeenCalled();
  expect(state.showBanner).not.toHaveBeenCalled();
});
it('uses only Google demo IDs and removes the banner when disabled', async () => {
  const { syncNativeAds, DEMO_BANNER_ID } =
    await import('../../src/services/native-ads');
  await syncNativeAds();
  await syncNativeAds();
  expect(state.showBanner).toHaveBeenCalledTimes(1);
  expect(state.showBanner).toHaveBeenCalledWith(
    expect.objectContaining({
      adId: DEMO_BANNER_ID,
      isTesting: true,
      npa: true,
    }),
  );
  state.ads = false;
  await syncNativeAds();
  expect(state.removeBanner).toHaveBeenCalled();
  expect(
    document.documentElement.style.getPropertyValue('--native-ad-height'),
  ).toBe('0px');
});
it('does not show an ad after disabling during initialization', async () => {
  let finish!: () => void;
  state.initialize.mockImplementation(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  const { syncNativeAds } = await import('../../src/services/native-ads');
  const first = syncNativeAds();
  await vi.waitFor(() => expect(state.initialize).toHaveBeenCalled());
  state.ads = false;
  const second = syncNativeAds();
  finish();
  await Promise.all([first, second]);
  expect(state.showBanner).not.toHaveBeenCalled();
});
it('contains SDK failure without changing the coaching preference', async () => {
  state.showBanner.mockRejectedValue(new Error('offline'));
  const { syncNativeAds } = await import('../../src/services/native-ads');
  await expect(syncNativeAds()).resolves.toBeUndefined();
  expect(state.ads).toBe(true);
  expect(document.querySelector('.sponsor-slot')?.textContent).toContain(
    'unavailable',
  );
});
