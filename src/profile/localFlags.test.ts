import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastOpenedTopic, setLastOpenedTopic } from './localFlags';

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
