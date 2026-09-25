import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { logEvent } from '@react-native-firebase/analytics';
import { RootNavigator } from '../navigation/RootNavigator';
import { saveOnboarding, saveTestDate } from '../profile/profile';
import type { Profile } from '../profile/profileData';
import { addDays, longDateLabel, toDateString } from '../profile/testDate';

// Slice 1 journey (docs/build-order.md) through the real navigator and screens. Only the
// modules that wrap native Firebase are mocked.
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn(),
}));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'ready', uid: 'u1' }) }));
jest.mock('../profile/profile', () => ({
  saveOnboarding: jest.fn(() => Promise.resolve()),
  saveTestDate: jest.fn(() => Promise.resolve()),
}));

let mockProfile: Profile = { onboarding: null, testDate: null };
jest.mock('../profile/ProfileProvider', () => ({
  useProfile: () => ({ status: 'ready', profile: mockProfile }),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockProfile = { onboarding: null, testDate: null };
});

const today = toDateString(new Date());
const fourWeeksOut = addDays(today, 28);

describe('first launch (ph-9-us-3)', () => {
  test('"Test what I know" + Skip lands in the baseline in three taps, and saves the choice', async () => {
    await render(<RootNavigator initialRoute="Welcome" />);

    await fireEvent.press(await screen.findByText('Get started'));
    await fireEvent.press(await screen.findByText('Test what I know'));
    await fireEvent.press(await screen.findByText('Skip for now'));

    expect(await screen.findByText('Baseline test')).toBeTruthy();
    expect(saveOnboarding).toHaveBeenCalledWith('u1', 'baseline', null);
    expect(await AsyncStorage.getItem('dmv-app:onboarding-done:u1')).toBe('1');
    expect(logEvent).toHaveBeenCalledWith(undefined, 'onboarding_complete', {
      choice: 'baseline',
      test_date_set: false,
    });
  });

  test('"Learn first" + a date lands on the Study tab and saves the date', async () => {
    await render(<RootNavigator initialRoute="Welcome" />);

    await fireEvent.press(await screen.findByText('Get started'));
    await fireEvent.press(await screen.findByText('Learn first'));
    // The picker opens about 4 weeks out.
    expect(await screen.findByText(longDateLabel(fourWeeksOut))).toBeTruthy();
    await fireEvent.press(screen.getByText('Continue'));

    expect(await screen.findByText('Concepts')).toBeTruthy();
    expect(saveOnboarding).toHaveBeenCalledWith('u1', 'learn', fourWeeksOut);
  });

  test('after onboarding, Home sits under the baseline and the onboarding screens are gone', async () => {
    await render(<RootNavigator initialRoute="Welcome" />);
    await fireEvent.press(await screen.findByText('Get started'));
    await fireEvent.press(await screen.findByText('Test what I know'));
    await fireEvent.press(await screen.findByText('Skip for now'));
    await screen.findByText('Baseline test');

    // The native header's Back button isn't rendered in tests, so check the stack instead:
    // Back from the baseline can only reach Home.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByText('Start your baseline', hidden)).toBeTruthy();
    expect(screen.queryByText('Get started', hidden)).toBeNull();
    expect(screen.queryByText('How do you want to start?', hidden)).toBeNull();
  });
});

describe('Home (ph-9-us-7 / ph-9-us-5)', () => {
  test('a returning user lands on Home with both routes and the add-date card', async () => {
    mockProfile = { onboarding: { choice: 'learn' }, testDate: null };
    await render(<RootNavigator initialRoute="Main" />);

    expect(await screen.findByText('Add your test date')).toBeTruthy();
    expect(screen.getByText('Start your baseline')).toBeTruthy();
    expect(screen.getByText('Learn concept by concept')).toBeTruthy();
  });

  test('shows the countdown for a saved date', async () => {
    mockProfile = { onboarding: { choice: 'baseline' }, testDate: addDays(today, 12) };
    await render(<RootNavigator initialRoute="Main" />);

    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('days until your test')).toBeTruthy();
  });

  test.each([
    [1, 'Your test is tomorrow'],
    [0, 'Test day — good luck!'],
    [-2, 'Your test date has passed'],
  ])('a test %i days away shows "%s"', async (days, label) => {
    mockProfile = { onboarding: { choice: 'baseline' }, testDate: addDays(today, days) };
    await render(<RootNavigator initialRoute="Main" />);
    expect(await screen.findByText(label)).toBeTruthy();
  });

  test('dismissing the add-date card hides it and remembers that on this device', async () => {
    mockProfile = { onboarding: { choice: 'learn' }, testDate: null };
    await render(<RootNavigator initialRoute="Main" />);

    await fireEvent.press(await screen.findByLabelText('Dismiss'));

    expect(screen.queryByText('Add your test date')).toBeNull();
    expect(await AsyncStorage.getItem('dmv-app:home:add-date-dismissed:u1')).toBe('1');
  });

  test('tapping the countdown opens the editor, where the date can be removed', async () => {
    mockProfile = { onboarding: { choice: 'baseline' }, testDate: addDays(today, 12) };
    await render(<RootNavigator initialRoute="Main" />);

    await fireEvent.press(await screen.findByText('days until your test'));
    await fireEvent.press(await screen.findByText('Remove date'));

    expect(saveTestDate).toHaveBeenCalledWith('u1', null);
  });

  test('Settings shows the test date and opens the editor', async () => {
    mockProfile = { onboarding: { choice: 'learn' }, testDate: '2027-01-15' };
    await render(<RootNavigator initialRoute="Main" />);

    await fireEvent.press(await screen.findByLabelText('Settings'));
    await fireEvent.press(await screen.findByText('Friday, January 15, 2027'));
    await fireEvent.press(await screen.findByText('Save date'));

    expect(saveTestDate).toHaveBeenCalledWith('u1', '2027-01-15');
  });
});
