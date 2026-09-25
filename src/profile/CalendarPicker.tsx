import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/tokens';
import {
  longDateLabel,
  monthGrid,
  monthLabel,
  parseDateString,
  type DateString,
} from './testDate';

// ph-9-us-5: a month-view date picker built in JS on the tested `monthGrid` helper. Chosen over
// a native picker so Slice 1 needs no new native module (and no dev-client rebuild); it can be
// swapped for @expo/ui's picker later without changing callers.
interface CalendarPickerProps {
  value: DateString;
  onChange: (value: DateString) => void;
  min: DateString;
  max: DateString;
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthKey(value: DateString): { year: number; month: number } {
  const d = parseDateString(value)!;
  return { year: d.year, month: d.month };
}

function shiftMonth({ year, month }: { year: number; month: number }, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function CalendarPicker({ value, onChange, min, max }: CalendarPickerProps) {
  const [shown, setShown] = useState(() => monthKey(value));
  const minMonth = monthKey(min);
  const maxMonth = monthKey(max);
  const canGoBack = shown.year * 12 + shown.month > minMonth.year * 12 + minMonth.month;
  const canGoForward = shown.year * 12 + shown.month < maxMonth.year * 12 + maxMonth.month;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setShown((m) => shiftMonth(m, -1))}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoBack }}
          hitSlop={8}
          style={[styles.arrow, !canGoBack && styles.hidden]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={typography.h2} accessibilityRole="header">
          {monthLabel(shown.year, shown.month)}
        </Text>
        <Pressable
          onPress={() => setShown((m) => shiftMonth(m, 1))}
          disabled={!canGoForward}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canGoForward }}
          hitSlop={8}
          style={[styles.arrow, !canGoForward && styles.hidden]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <Text key={i} style={[typography.small, styles.cell, styles.weekday]}>
            {initial}
          </Text>
        ))}
      </View>

      {monthGrid(shown.year, shown.month).map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((day, d) => {
            if (!day) return <View key={d} style={styles.cell} />;
            const enabled = day >= min && day <= max;
            const selected = day === value;
            return (
              <Pressable
                key={d}
                onPress={() => onChange(day)}
                disabled={!enabled}
                accessibilityRole="button"
                accessibilityLabel={longDateLabel(day)}
                accessibilityState={{ selected, disabled: !enabled }}
                style={[styles.cell, styles.day, selected && styles.selected]}
              >
                <Text
                  style={[
                    typography.body,
                    !enabled && styles.disabledText,
                    selected && styles.selectedText,
                  ]}
                >
                  {parseDateString(day)!.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.space3,
    gap: spacing.space1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.space2,
  },
  arrow: { padding: spacing.space1 },
  hidden: { opacity: 0 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  weekday: { textAlign: 'center', textAlignVertical: 'center', aspectRatio: undefined },
  day: { borderRadius: radius.pill },
  selected: { backgroundColor: colors.primary },
  selectedText: { color: colors.surface, fontFamily: typography.bodySemibold.fontFamily },
  disabledText: { color: colors.line },
});
