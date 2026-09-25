import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * The current date, refreshed when the screen regains focus or the app returns to the
 * foreground, so a countdown left open overnight rolls over to the new day (ph-9-us-5).
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  const refresh = useCallback(() => setToday(new Date()), []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return today;
}
