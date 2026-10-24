import { expect, it } from 'vitest';
import {
  markOnboardingDone,
  onboardingDone,
  ONBOARDING_KEY,
} from '../../src/ui/onboarding';

it('remembers that the guide was seen, and never loops on blocked storage', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  expect(onboardingDone(storage)).toBe(false);
  markOnboardingDone(storage);
  expect(store.get(ONBOARDING_KEY)).toBe('done');
  expect(onboardingDone(storage)).toBe(true);
  const blocked = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  expect(onboardingDone(blocked)).toBe(true);
  expect(() => markOnboardingDone(blocked)).not.toThrow();
});
