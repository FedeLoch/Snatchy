import type { StoragePort } from './history';
export interface FeaturePreferences {
  ads: boolean;
  coachingPreview: boolean;
}
export const FEATURE_KEY = 'snatchy-features-v1';
export function loadFeatures(storage: StoragePort): FeaturePreferences {
  try {
    const raw = JSON.parse(storage.getItem(FEATURE_KEY) ?? '{}');
    return {
      ads: typeof raw?.ads === 'boolean' ? raw.ads : true,
      coachingPreview: raw?.coachingPreview === true,
    };
  } catch {
    return { ads: true, coachingPreview: false };
  }
}
let session: FeaturePreferences | undefined;
export function features(): FeaturePreferences {
  if (!session) {
    try {
      session = loadFeatures(localStorage);
    } catch {
      session = { ads: true, coachingPreview: false };
    }
  }
  return { ...session };
}
export function setFeature(
  key: keyof FeaturePreferences,
  value: boolean,
): boolean {
  session = { ...features(), [key]: value };
  try {
    localStorage.setItem(FEATURE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
