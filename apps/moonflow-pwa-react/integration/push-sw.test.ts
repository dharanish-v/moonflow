// The service worker's push handler (public/push-sw.js), run against a fake
// IndexedDB: every push shows a notification, neutral unless this phone said
// otherwise.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db';

const code = readFileSync(resolve(import.meta.dirname, '../public/push-sw.js'), 'utf8');

function loadWorker() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const fakeSelf = {
    addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[type] = fn),
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn().mockResolvedValue(null) },
  };
  new Function('self', 'indexedDB', code)(fakeSelf, indexedDB);
  async function push() {
    let done: Promise<unknown> = Promise.resolve();
    handlers.push!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  return { push, showNotification, handlers, fakeSelf };
}

beforeEach(async () => {
  await db.settings.clear();
});

describe('push-sw.js (ADR-055)', () => {
  it('says only "Reminder" by default', async () => {
    await db.settings.put({ key: 'onboardingComplete', value: true });
    const w = loadWorker();
    await w.push();
    expect(w.showNotification).toHaveBeenCalledWith('Reminder', expect.objectContaining({ body: '' }));
  });

  it('says "Period likely tomorrow" when this phone chose detailed text', async () => {
    await db.settings.put({ key: 'detailedReminderText', value: true });
    const w = loadWorker();
    await w.push();
    expect(w.showNotification).toHaveBeenCalledWith('Period likely tomorrow', expect.anything());
  });

  it('opens the app when the notification is tapped', async () => {
    const w = loadWorker();
    const close = vi.fn();
    let done: Promise<unknown> = Promise.resolve();
    w.handlers.notificationclick!({ notification: { close }, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(close).toHaveBeenCalled();
    expect(w.fakeSelf.clients.openWindow).toHaveBeenCalledWith('./');
  });
});
