// public/push-sw.js — T103 (ADR-055), imported into the generated service
// worker. Pushes arrive empty; what the notification says is decided here,
// from this phone's own setting, so the server never knows. iOS requires
// every push to show a notification.
const DB_NAME = 'MoonflowDB';

function readSetting(key) {
  return new Promise((resolve) => {
    const open = indexedDB.open(DB_NAME);
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      try {
        const req = open.result.transaction('settings', 'readonly').objectStore('settings').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    };
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    readSetting('detailedReminderText').then((detailed) =>
      self.registration.showNotification(detailed === true ? 'Period likely tomorrow' : 'Reminder', {
        body: detailed === true ? 'Based on your logs. Tap to open.' : '',
        tag: 'moonflow-reminder',
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) =>
      windows.length > 0 ? windows[0].focus() : self.clients.openWindow('./'),
    ),
  );
});
