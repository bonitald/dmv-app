import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDeckPass,
  getLastOpenedTopic,
  getPracticeMode,
  setDeckPass,
  setLastOpenedTopic,
  setPracticeMode,
} from './localFlags';

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

test('practice mode defaults to untimed and remembers the last choice per uid', async () => {
  expect(await getPracticeMode('u1')).toBe('untimed');
  await setPracticeMode('u1', 'timed');
  expect(await getPracticeMode('u1')).toBe('timed');
  expect(await getPracticeMode('u2')).toBe('untimed');
  expect(await AsyncStorage.getItem('dmv-app:practice-mode:u1')).toBe('timed');
  await setPracticeMode('u1', 'untimed');
  expect(await getPracticeMode('u1')).toBe('untimed');
});

test('an unrecognised stored practice mode reads as untimed', async () => {
  await AsyncStorage.setItem('dmv-app:practice-mode:u1', 'banana');
  expect(await getPracticeMode('u1')).toBe('untimed');
});

test('practice mode storage failures never throw', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
  expect(await getPracticeMode('u1')).toBe('untimed');
  await expect(setPracticeMode('u1', 'timed')).resolves.toBeUndefined();
  warn.mockRestore();
});
