import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeckPosition, getLastOpenedTopic, setDeckPosition, setLastOpenedTopic } from './localFlags';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('last-opened topic is stored per uid', async () => {
  expect(await getLastOpenedTopic('u1')).toBeNull();
  await setLastOpenedTopic('u1', 'row');
  expect(await getLastOpenedTopic('u1')).toBe('row');
  expect(await getLastOpenedTopic('u2')).toBeNull();
  expect(await AsyncStorage.getItem('dmv-app:study:last-opened:u1')).toBe('row');
});

test('a storage failure reads as none', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  expect(await getLastOpenedTopic('u1')).toBeNull();
  warn.mockRestore();
});

test('deck position is stored per uid and topic, and null clears it', async () => {
  expect(await getDeckPosition('u1', 'row')).toBeNull();
  await setDeckPosition('u1', 'row', 'q7');
  expect(await getDeckPosition('u1', 'row')).toBe('q7');
  expect(await getDeckPosition('u1', 'signs')).toBeNull();
  expect(await getDeckPosition('u2', 'row')).toBeNull();
  await setDeckPosition('u1', 'row', null);
  expect(await getDeckPosition('u1', 'row')).toBeNull();
});
