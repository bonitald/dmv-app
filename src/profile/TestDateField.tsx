import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { CalendarPicker } from './CalendarPicker';
import {
  initialPickerDate,
  longDateLabel,
  selectableRange,
  type DateString,
} from './testDate';

// ph-9-us-5: the date step's picker, reused by onboarding and the test date editor. The picker
// opens on the saved date (if still selectable) or about 4 weeks out, and only allows today to
// 12 months ahead. `today` is fixed when the screen opens.
export function useTestDateSelection(saved: DateString | null) {
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState(() => initialPickerDate(saved, today));
  return { today, selected, setSelected };
}

interface TestDateFieldProps {
  today: Date;
  selected: DateString;
  onChange: (value: DateString) => void;
}

export function TestDateField({ today, selected, onChange }: TestDateFieldProps) {
  const { min, max } = selectableRange(today);
  return (
    <View style={styles.container}>
      <CalendarPicker value={selected} onChange={onChange} min={min} max={max} />
      <Text style={[typography.bodySemibold, styles.selected]} accessibilityLiveRegion="polite">
        {longDateLabel(selected)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.space3 },
  selected: { textAlign: 'center', color: colors.primary },
});
