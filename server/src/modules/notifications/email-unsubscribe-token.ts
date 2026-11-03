import { createHmac, timingSafeEqual } from 'node:crypto';

function signature(userIdentity: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`daily-reminder-unsubscribe:${userIdentity}`).digest();
}

export function createUnsubscribeToken(userId: string, secret: string): string {
  const identity = Buffer.from(userId, 'utf8').toString('base64url');
  const signed = signature(identity, secret).toString('base64url');
  return `${identity}.${signed}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (token.length > 512) return null;
  const [identity, signed, ...extra] = token.split('.');
  if (!identity || !signed || extra.length > 0 || !secret) return null;
  try {
    const receivedSignature = Buffer.from(signed, 'base64url');
    const expectedSignature = signature(identity, secret);
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return null;
    }
    const userId = Buffer.from(identity, 'base64url').toString('utf8');
    return userId.length > 0 ? userId : null;
  } catch {
    return null;
  }
}
