import api from './client';

export async function getPushPublicKey(): Promise<string | null> {
  const response = await api.get<{ publicKey: string | null }>('/push/public-key');
  return response.data.publicKey;
}

export async function subscribePush(subscription: PushSubscriptionJSON, lang: string): Promise<void> {
  const keys = subscription.keys;
  if (!subscription.endpoint || !keys?.p256dh || !keys.auth) throw new Error('Invalid subscription');
  await api.post('/push/subscribe', {
    endpoint: subscription.endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    lang,
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await api.post('/push/unsubscribe', { endpoint });
}

export interface PushTestResult {
  configured: boolean;
  devices: number;
  delivered: number;
}

export async function sendTestPush(): Promise<PushTestResult> {
  const response = await api.post<PushTestResult>('/push/test');
  return response.data;
}

export interface PushStatus {
  configured: boolean;
  /** Dispositivos desta conta com push registado (todos, nao so este). */
  devices: number;
}

export async function getPushStatus(): Promise<PushStatus> {
  const response = await api.get<PushStatus>('/push/status');
  return response.data;
}
