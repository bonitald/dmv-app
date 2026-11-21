import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatClock, remainingSeconds, warningFor, type TimeWarning } from './timing';

const NOTICE_MS = 10_000;
const NOTICE_TEXT: Record<TimeWarning, string> = {
  '5min': '5 minutes left',
  '1min': '1 minute left',
};

export function TestTimer({
  startedAt,
  limitSec,
  onExpire,
  now = Date.now,
}: {
  startedAt: number;
  limitSec: number;
  onExpire: () => void;
  now?: () => number;
}): React.ReactElement {
  const [remaining, setRemaining] = useState(() => remainingSeconds(startedAt, limitSec, now()));
  const [notice, setNotice] = useState<TimeWarning | null>(null);
  const expired = useRef(false);
  const shown = useRef<TimeWarning | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Always recomputed from startedAt, never decremented.
  const recompute = useCallback(() => {
    const r = remainingSeconds(startedAt, limitSec, now());
    setRemaining(r);
    if (r === 0) {
      if (!expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
      return;
    }
    const w = warningFor(r);
    if (w && w !== shown.current) {
      shown.current = w;
      setNotice(w);
      AccessibilityInfo.announceForAccessibility(NOTICE_TEXT[w]);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    }
  }, [startedAt, limitSec, now]);

  useEffect(() => {
    recompute();
    const id = setInterval(recompute, 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recompute();
    });
    return () => {
      clearInterval(id);
      sub.remove();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [recompute]);

  const minutes = Math.ceil(remaining / 60);
  const label =
    remaining < 60
      ? `${remaining} seconds left`
      : minutes === 1
        ? '1 minute left'
        : `${minutes} minutes left`;
  const last = remaining <= 60;

  return (
    <View style={styles.wrap}>
      <View style={styles.pill} accessible accessibilityLabel={label}>
        <Text style={[styles.clock, last && styles.clockAlert]}>{formatClock(remaining)}</Text>
      </View>
      {notice ? <Text style={styles.notice}>{NOTICE_TEXT[notice]}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  pill: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space1,
  },
  clock: { ...typography.bodySemibold, fontVariant: ['tabular-nums'] },
  clockAlert: { color: colors.alert },
  notice: { ...typography.small, marginTop: spacing.space1 },
});
