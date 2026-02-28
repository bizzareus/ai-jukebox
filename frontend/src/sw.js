/* eslint-env serviceworker */
import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Jukebox';
  const options = {
    body: data.body || '',
    tag: data.tag || 'default',
    icon: '/icon-192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
