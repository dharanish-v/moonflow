import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_URL } from './backend-url';
import { db, getSetting, saveSettings } from './db';
import { disablePush, enablePush, refreshPushReminders } from './push';

const SESSION = { userId: 'u1', email: 'me@example.com', token: 'tok' };
const ENDPOINT = 'https://web.push.apple.com/abc';
const COLLECTION = `${BACKEND_URL}/api/collections/push_subscriptions/records`;

function mockBrowser(permission: NotificationPermission = 'granted') {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const sub = { endpoint: ENDPOINT, unsubscribe };
  const pushManager = { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockResolvedValue(sub) };
  const reg = { pushManager };
  vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue(permission) });
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(reg), getRegistration: vi.fn().mockResolvedValue(reg) } });
  return { pushManager, sub, unsubscribe };
}

function respond(...replies: Array<[number, unknown]>) {
  const fn = vi.fn();
  for (const [status, body] of replies) fn.mockResolvedValueOnce(new Response(body === null ? null : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(async () => {
  await db.settings.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('push reminders on this device (ADR-055)', () => {
  it('subscribes with the VAPID key and registers only the endpoint and times', async () => {
    const { pushManager } = mockBrowser();
    const fetch = respond([200, { id: 'rec1' }]);
    expect(await enablePush(SESSION, [100, 200])).toEqual({ ok: true });
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) }));
    expect(pushManager.subscribe.mock.calls[0]![0].applicationServerKey).toHaveLength(65);
    expect(fetch.mock.calls[0]![0]).toBe(COLLECTION);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ user: 'u1', endpoint: ENDPOINT, reminders: [100, 200] });
    expect(await getSetting('pushReminders')).toEqual({ recordId: 'rec1', endpoint: ENDPOINT, reminders: [100, 200] });
  });

  it('stops if notifications aren’t allowed, without telling the server anything', async () => {
    mockBrowser('denied');
    const fetch = respond();
    expect(await enablePush(SESSION, [100])).toMatchObject({ ok: false, error: expect.stringMatching(/turned off/) });
    expect(fetch).not.toHaveBeenCalled();
    expect(await getSetting('pushReminders')).toBeNull();
  });

  it('reuses a registration left over from an earlier attempt', async () => {
    mockBrowser();
    respond([400, {}], [200, { items: [{ id: 'old' }] }], [200, { id: 'old' }]);
    expect(await enablePush(SESSION, [100])).toEqual({ ok: true });
    expect((await getSetting('pushReminders'))?.recordId).toBe('old');
  });

  it('only sends new times when they changed, and forgets a subscription the server dropped', async () => {
    await saveSettings({ pushReminders: { recordId: 'rec1', endpoint: ENDPOINT, reminders: [100] } });
    const none = respond();
    expect(await refreshPushReminders(SESSION, [100])).toBe(true);
    expect(none).not.toHaveBeenCalled();
    const fetch = respond([200, { id: 'rec1' }]);
    await refreshPushReminders(SESSION, [300]);
    expect(fetch.mock.calls[0]![0]).toBe(`${COLLECTION}/rec1`);
    expect((await getSetting('pushReminders'))?.reminders).toEqual([300]);
    respond([404, {}]);
    expect(await refreshPushReminders(SESSION, [400])).toBe(false);
    expect(await getSetting('pushReminders')).toBeNull();
  });

  it('turning off deletes the server row, unsubscribes and clears the local state', async () => {
    const { pushManager, unsubscribe } = mockBrowser();
    pushManager.getSubscription.mockResolvedValue({ endpoint: ENDPOINT, unsubscribe });
    await saveSettings({ pushReminders: { recordId: 'rec1', endpoint: ENDPOINT, reminders: [100] } });
    const fetch = respond([204, null]);
    await disablePush(SESSION);
    expect(fetch.mock.calls[0]![1].method).toBe('DELETE');
    expect(unsubscribe).toHaveBeenCalled();
    expect(await getSetting('pushReminders')).toBeNull();
  });
});
