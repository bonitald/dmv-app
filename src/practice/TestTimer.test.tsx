import { AccessibilityInfo, AppState } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { colors } from '../theme/tokens';
import { TestTimer } from './TestTimer';

const LIMIT = 3600;
let nowMs = 0;
const now = () => nowMs;

async function advance(ms: number) {
  nowMs += ms;
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

let appStateHandler: ((s: string) => void) | undefined;
const remove = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  nowMs = 1_000_000;
  appStateHandler = undefined;
  remove.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, h: (s: string) => void) => {
    appStateHandler = h;
    return { remove };
  }) as never);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const setup = async (startedAt = nowMs, onExpire = jest.fn()) => {
  const utils = await render(<TestTimer startedAt={startedAt} limitSec={LIMIT} onExpire={onExpire} now={now} />);
  return { ...utils, onExpire };
};

test('shows the time left and ticks every second', async () => {
  await setup();
  expect(screen.getByText('60:00')).toBeTruthy();
  await advance(1000);
  expect(screen.getByText('59:59')).toBeTruthy();
});

test('recomputes from startedAt, not by counting ticks', async () => {
  await setup();
  nowMs += 10 * 60 * 1000;
  await advance(1000);
  expect(screen.getByText('49:59')).toBeTruthy();
});

test('calls onExpire once at zero', async () => {
  const { onExpire } = await setup();
  await advance(LIMIT * 1000 + 1000);
  await advance(5000);
  expect(onExpire).toHaveBeenCalledTimes(1);
});

test('expires on mount when already past the limit', async () => {
  const { onExpire } = await setup(nowMs - 2 * 3600 * 1000);
  expect(onExpire).toHaveBeenCalledTimes(1);
  expect(screen.getByText('0:00')).toBeTruthy();
});

test('rechecks when the app returns to the foreground', async () => {
  const { onExpire } = await setup();
  expect(onExpire).not.toHaveBeenCalled();
  nowMs += LIMIT * 1000 + 1000;
  await act(async () => appStateHandler?.('active'));
  expect(onExpire).toHaveBeenCalledTimes(1);
});

test('shows "5 minutes left" after crossing 5 minutes, then hides it', async () => {
  await setup(nowMs - (LIMIT - 301) * 1000);
  expect(screen.queryByText('5 minutes left')).toBeNull();
  await advance(1000);
  expect(screen.getByText('5 minutes left')).toBeTruthy();
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('5 minutes left');
  await advance(10000);
  expect(screen.queryByText('5 minutes left')).toBeNull();
});

test('resumed under a minute shows "1 minute left" once', async () => {
  await setup(nowMs - (LIMIT - 30) * 1000);
  expect(screen.getByText('1 minute left')).toBeTruthy();
  expect(screen.queryByText('5 minutes left')).toBeNull();
  await advance(1000);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
});

test('uses the alert color in the last minute', async () => {
  await setup(nowMs - (LIMIT - 30) * 1000);
  expect(screen.getByText('0:30')).toHaveStyle({ color: colors.alert });
});

test('labels the pill in minutes, then seconds', async () => {
  await setup(nowMs - (LIMIT - 125) * 1000);
  expect(screen.getByLabelText('3 minutes left')).toBeTruthy();
  await advance(70000);
  expect(screen.getByLabelText('55 seconds left')).toBeTruthy();
});

test('cleans up the interval and listener on unmount', async () => {
  const clock = jest.fn(now);
  const { unmount } = await render(<TestTimer startedAt={nowMs} limitSec={LIMIT} onExpire={jest.fn()} now={clock} />);
  await unmount();
  expect(remove).toHaveBeenCalled();
  clock.mockClear();
  await advance(5000);
  expect(clock).not.toHaveBeenCalled();
});
