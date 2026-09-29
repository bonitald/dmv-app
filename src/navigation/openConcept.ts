import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Every "go study this topic" link (baseline results, review) goes through here. The Study tab
// is still the concept-list placeholder, so this opens the tab; Slice 4a (ph-2-us-7 / us-3)
// changes this one function to open the topic's flashcards.
export function openConcept(
  navigation: NavigationProp<RootStackParamList>,
  _chunkId: string
): void {
  navigation.navigate('Main', { screen: 'Study' });
}
