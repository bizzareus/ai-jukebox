const BASE = import.meta.env.VITE_API_URL + '/api';

export async function getVapidPublicKey(): Promise<string | null> {
  const res = await fetch(`${BASE}/notifications/vapid-public-key`);
  const data = await res.json();
  return data.publicKey ?? null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribeForPush(publicKey: string): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported');
    return null;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  return sub;
}

export function subscriptionToPayload(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint!,
    keys: {
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    },
  };
}
