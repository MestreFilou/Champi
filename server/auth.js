import { createHmac, timingSafeEqual } from 'node:crypto';

// Accès par mot de passe (variable d'environnement APP_PASSWORD sur Vercel).
// Le cookie contient une empreinte du mot de passe : changer le mot de passe déconnecte tous les appareils.

export const COOKIE = 'champi_auth';
export const ONE_YEAR = 365 * 24 * 3600;

export const authToken = (password) => createHmac('sha256', password).update('champi-v1').digest('hex');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export const isAuthorized = (cookieHeader, password) => {
  const token = readCookie(cookieHeader, COOKIE);
  return !!token && safeEqual(token, authToken(password));
};
