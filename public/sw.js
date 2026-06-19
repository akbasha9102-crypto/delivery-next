self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'delivery',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || '/';
  // منع open-redirect: نقبل فقط مسارات نسبية أو نفس الـ origin
  const safeUrl = raw.startsWith('/') ? raw : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(safeUrl) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(safeUrl);
    })
  );
});
