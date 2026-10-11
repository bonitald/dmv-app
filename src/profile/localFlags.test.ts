import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeckPass, getLastOpenedTopic, setDeckPass, setLastOpenedTopic } from './localFlags';

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


test('deck pass is stored per uid and topic, and null clears it', async () => {
  const pass = { mode: 'full' as const, cardIds: ['q7', 'q8'], cardId: 'q7' };
  expect(await getDeckPass('u1', 'row')).toBeNull();
  await setDeckPass('u1', 'row', pass);
  expect(await getDeckPass('u1', 'row')).toEqual(pass);
  expect(await getDeckPass('u1', 'signs')).toBeNull();
  expect(await getDeckPass('u2', 'row')).toBeNull();
  await setDeckPass('u1', 'row', null);
  expect(await getDeckPass('u1', 'row')).toBeNull();
});

test('a 4a plain card id reads as no saved pass', async () => {
  await AsyncStorage.setItem('dmv-app:study:deck-position:u1:row', 'q7');
  expect(await getDeckPass('u1', 'row')).toBeNull();
});
