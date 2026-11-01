import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_URL } from './backend-url';
import { deleteAccount, refreshSession, signIn, signUp } from './account';

const session = { userId: 'u1', email: 'a@b.co', token: 'tok' };
const authBody = { token: 'tok', record: { id: 'u1', email: 'a@b.co' } };

function respond(...replies: Array<[number, unknown] | 'offline'>) {
  const fn = vi.fn();
  for (const r of replies) {
    if (r === 'offline') fn.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    else fn.mockResolvedValueOnce(new Response(r[1] === null ? null : JSON.stringify(r[1]), { status: r[0] }));
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('account API', () => {
  it('signs up, then signs in, and returns the session', async () => {
    const fetch = respond([200, { id: 'u1' }], [200, authBody]);
    expect(await signUp(' a@b.co ', 'long enough pw')).toEqual({ ok: true, session });
    expect(fetch.mock.calls[0]![0]).toBe(`${BACKEND_URL}/api/collections/users/records`);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ email: 'a@b.co', password: 'long enough pw', passwordConfirm: 'long enough pw' });
    expect(fetch.mock.calls[1]![0]).toBe(`${BACKEND_URL}/api/collections/users/auth-with-password`);
  });

  it('explains a taken email, a bad email and a short password', async () => {
    respond([400, { data: { email: { code: 'validation_not_unique' } } }]);
    expect(await signUp('a@b.co', 'long enough pw')).toMatchObject({ ok: false, error: expect.stringMatching(/already exists/) });
    respond([400, { data: { email: { code: 'validation_is_email' } } }]);
    expect(await signUp('nope', 'long enough pw')).toMatchObject({ ok: false, error: expect.stringMatching(/valid email/) });
    respond([400, { data: { password: { code: 'validation_min_text_constraint' } } }]);
    expect(await signUp('a@b.co', 'short')).toMatchObject({ ok: false, error: expect.stringMatching(/at least 10/) });
  });

  it('does not say whether the email or the password was wrong', async () => {
    respond([400, { message: 'Failed to authenticate.' }]);
    expect(await signIn('a@b.co', 'wrong password')).toMatchObject({ ok: false, error: expect.stringMatching(/don’t match an account/) });
  });

  it('reports being offline instead of failing', async () => {
    respond('offline');
    expect(await signIn('a@b.co', 'x')).toMatchObject({ ok: false, error: expect.stringMatching(/Can't reach the server/) });
  });

  it('refreshes a session, and tells expired apart from offline', async () => {
    const fetch = respond([200, { ...authBody, token: 'new' }]);
    expect(await refreshSession(session)).toEqual({ ok: true, session: { ...session, token: 'new' } });
    expect(fetch.mock.calls[0]![1].headers.authorization).toBe('tok');
    respond([401, {}]);
    expect(await refreshSession(session)).toEqual({ ok: false, reason: 'expired' });
    respond('offline');
    expect(await refreshSession(session)).toEqual({ ok: false, reason: 'offline' });
  });

  it('deletes the signed-in account', async () => {
    const fetch = respond([204, null]);
    expect(await deleteAccount(session)).toEqual({ ok: true });
    expect(fetch.mock.calls[0]![0]).toBe(`${BACKEND_URL}/api/collections/users/records/u1`);
    expect(fetch.mock.calls[0]![1].method).toBe('DELETE');
    respond([404, {}]);
    expect(await deleteAccount(session)).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
  });
});
