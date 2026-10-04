import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Every "go study this topic" link (baseline results, review) goes through here, so they all
// open that topic's flashcards (Slice 4a, ph-2-us-3). Back returns to where the link was.
export function openConcept(
  navigation: NavigationProp<RootStackParamList>,
  chunkId: string
): void {
  navigation.navigate('Flashcards', { chunkId });
}
