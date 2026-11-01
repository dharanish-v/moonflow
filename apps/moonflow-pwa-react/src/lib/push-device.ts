// src/lib/push-device.ts — T103. Ends this browser's push subscription, best
// effort. No backend call and no imports, so db.ts can use it on erase: once
// unsubscribed, the push service answers 410 and the server deletes the row.
export async function unsubscribeThisDevice(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    await sub?.unsubscribe();
  } catch {
    // No service worker or push support: nothing to stop.
  }
}
