import { getDb } from './adminApp';

describe('getDb', () => {
  it('connects to the Firestore emulator and can write/read a document', async () => {
    const db = getDb();
    const ref = db.collection('_adminAppTest').doc('ping');

    await ref.set({ ok: true });
    const snap = await ref.get();

    expect(snap.data()).toEqual({ ok: true });
  });
});
