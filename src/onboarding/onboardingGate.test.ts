import { describe, expect, test } from '@jest/globals';
import { resolveInitialRoute } from './onboardingGate';
import { toProfile } from '../profile/profileData';

const onboarded = toProfile({ onboarding: { choice: 'learn' } });
const fresh = toProfile({ createdAt: new Date() });

describe('resolveInitialRoute', () => {
  test('waits until the local flag has been read', () => {
    expect(resolveInitialRoute(null, 'ready', onboarded)).toBeNull();
  });

  test('a returning user with the local flag goes straight to the tabs, even before the profile loads', () => {
    expect(resolveInitialRoute(true, 'loading', null)).toBe('Main');
    expect(resolveInitialRoute(true, 'error', null)).toBe('Main');
  });

  test('without the flag, waits for the profile', () => {
    expect(resolveInitialRoute(false, 'loading', null)).toBeNull();
  });

  test('a profile with onboarding skips onboarding', () => {
    expect(resolveInitialRoute(false, 'ready', onboarded)).toBe('Main');
  });

  test('a new profile shows onboarding', () => {
    expect(resolveInitialRoute(false, 'ready', fresh)).toBe('Welcome');
  });

  test('an unreadable profile with no flag falls back to onboarding', () => {
    expect(resolveInitialRoute(false, 'error', null)).toBe('Welcome');
  });
});

describe('toProfile', () => {
  test('keeps valid fields', () => {
    expect(toProfile({ onboarding: { choice: 'baseline', completedAt: 1 }, testDate: '2026-10-22' })).toEqual({
      onboarding: { choice: 'baseline' },
      testDate: '2026-10-22',
    });
  });

  test('treats malformed or missing values as unset', () => {
    expect(toProfile({ onboarding: { choice: 'other' }, testDate: '2026-02-31' })).toEqual({
      onboarding: null,
      testDate: null,
    });
    expect(toProfile(undefined)).toEqual({ onboarding: null, testDate: null });
  });
});
