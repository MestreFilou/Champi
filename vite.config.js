import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// MOBILE=1 : HTTPS (certificat auto-signé) + écoute sur le réseau local, pour ouvrir l'appli depuis le
// téléphone. Le navigateur n'autorise le GPS qu'en HTTPS.
const mobile = process.env.MOBILE === '1';

export default defineConfig({
  root: 'web',
  plugins: [react(), ...(mobile ? [basicSsl()] : [])],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, host: mobile || undefined, proxy: { '/api': 'http://localhost:3001' } },
});
