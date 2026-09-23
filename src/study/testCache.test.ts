import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTestCache, getTestCache, clearTestCache } from './testCache';

describe('testCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const sampleQuestions = [
    { id: 'q1', text: 'What does a red light mean?', choices: ['Stop', 'Go'], type: 'fact', chunkId: 'signs', conceptId: 'c1' },
  ];

  it('round-trips a saved question set', async () => {
    await saveTestCache('test-1', sampleQuestions);

    const result = await getTestCache('test-1');

    expect(result).toEqual(sampleQuestions);
  });

  it('returns null for a testId that was never saved', async () => {
    const result = await getTestCache('never-saved');

    expect(result).toBeNull();
  });

  it('removes the entry on clear', async () => {
    await saveTestCache('test-1', sampleQuestions);

    await clearTestCache('test-1');

    expect(await getTestCache('test-1')).toBeNull();
  });

  it('keeps a stale cached test intact when a different testId is saved', async () => {
    await saveTestCache('stale-test', sampleQuestions);

    await saveTestCache('new-test', [{ ...sampleQuestions[0], id: 'q2' }]);

    expect(await getTestCache('stale-test')).toEqual(sampleQuestions);
    expect(await getTestCache('new-test')).toEqual([{ ...sampleQuestions[0], id: 'q2' }]);
  });

  it('propagates a write failure to the caller instead of failing silently', async () => {
    const setItemSpy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('storage full'));

    await expect(saveTestCache('test-1', sampleQuestions)).rejects.toThrow('storage full');

    setItemSpy.mockRestore();
  });
});
