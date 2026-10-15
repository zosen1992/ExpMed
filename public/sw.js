// public/sw.js
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'MOSTRAR_ALERTA_CLINICA') {
    const { titulo, opciones } = event.data.payload;
    event.waitUntil(
      self.registration.showNotification(titulo, opciones)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Tomamos el scope del Service Worker (ej. https://proyectosms.com.mx/DemoExp/)
  const baseScope = self.registration.scope.replace(/\/$/, '');
  const rutaInterna = (event.notification.data && event.notification.data.url) || '/';
  const urlCompleta = rutaInterna.startsWith('http') ? rutaInterna : `${baseScope}${rutaInterna}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVEGAR_DESDE_NOTIFICACION',
            url: rutaInterna
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlCompleta);
      }
    })
  );
});