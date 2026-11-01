// src/lib/push.ts — T103 (ADR-055): push reminders on this device. The server
// only learns where to push and when; the service worker decides what the
// notification says (public/push-sw.js).
import { backendBase } from './backend';
import { getSetting, saveSettings } from './db';
import { VAPID_PUBLIC_KEY } from './push-config';
import { unsubscribeThisDevice } from './push-device';
import type { AccountSession, PushReminderState } from './types';

export type PushResult = { ok: true } | { ok: false; error: string };

const OFFLINE = "Can't reach the server. Check your connection and try again.";
const COLLECTION = '/api/collections/push_subscriptions/records';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function call(session: AccountSession, method: string, path: string, body?: unknown) {
  try {
    const res = await fetch(`${backendBase()}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: session.token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as Record<string, unknown> | null };
  } catch {
    return null;
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Asks for permission (call from a tap), subscribes, and registers the
 * reminders with the server. */
export async function enablePush(session: AccountSession, reminders: number[]): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, error: 'This browser can’t show notifications.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, error: 'Notifications are turned off for Moonflow. Allow them in Settings → Notifications.' };
  let endpoint: string;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    endpoint = sub.endpoint;
  } catch {
    return { ok: false, error: 'Couldn’t turn on notifications on this device.' };
  }

  let res = await call(session, 'POST', COLLECTION, { user: session.userId, endpoint, reminders });
  if (!res) return { ok: false, error: OFFLINE };
  if (res.status !== 200) {
    // Already registered (e.g. an earlier attempt half-finished): reuse it.
    const found = await call(session, 'GET', `${COLLECTION}?perPage=1&filter=${encodeURIComponent(`endpoint = "${endpoint}"`)}`);
    const id = (found?.body?.items as Array<{ id: string }> | undefined)?.[0]?.id;
    if (!id) return { ok: false, error: 'Couldn’t register this device for reminders.' };
    res = await call(session, 'PATCH', `${COLLECTION}/${id}`, { reminders });
    if (!res || res.status !== 200) return { ok: false, error: OFFLINE };
  }
  const state: PushReminderState = { recordId: String(res.body!.id), endpoint, reminders };
  return (await saveSettings({ pushReminders: state })) ? { ok: true } : { ok: false, error: 'Couldn’t save that on this phone.' };
}

/** Sends new reminder times when the predictions moved. Quiet on failure:
 * the next sync tries again. Returns true if the server has these times. */
export async function refreshPushReminders(session: AccountSession, reminders: number[]): Promise<boolean> {
  const state = await getSetting('pushReminders');
  if (!state) return true;
  if (JSON.stringify(state.reminders) === JSON.stringify(reminders)) return true;
  const res = await call(session, 'PATCH', `${COLLECTION}/${state.recordId}`, { reminders });
  if (res?.status === 404) {
    // The server dropped it (the push service said it was gone).
    await saveSettings({ pushReminders: null });
    return false;
  }
  if (res?.status !== 200) return false;
  return saveSettings({ pushReminders: { ...state, reminders } });
}

/** Turns reminders off on this device: server row, push subscription, local state. */
export async function disablePush(session: AccountSession | null): Promise<void> {
  const state = await getSetting('pushReminders');
  if (state && session) await call(session, 'DELETE', `${COLLECTION}/${state.recordId}`);
  await unsubscribeThisDevice();
  await saveSettings({ pushReminders: null });
}
