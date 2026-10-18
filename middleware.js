// Vercel Routing Middleware : exécuté avant chaque requête, pages comme API.
// Sans variable APP_PASSWORD, l'appli reste ouverte (utile pour tester un déploiement).
import { next } from '@vercel/functions';
import { isAuthorized } from './server/auth.js';

export const config = { runtime: 'nodejs' };

// Ce qu'il faut pour afficher la page de connexion et installer l'appli
const PUBLIC = new Set(['/login.html', '/api/login', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']);

export default function middleware(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return next();
  const { pathname } = new URL(request.url);
  if (PUBLIC.has(pathname) || isAuthorized(request.headers.get('cookie'), password)) return next();
  if (pathname.startsWith('/api/')) {
    return Response.json({ error: 'Connexion requise : recharge la page pour te reconnecter.' }, { status: 401 });
  }
  return new Response(null, { status: 302, headers: { Location: '/login.html' } });
}
