import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { libraryCredits } from './scripts/vite-library-credits.ts';

const core = (path: string) => fileURLToPath(new URL(`./core/${path}`, import.meta.url));

export default defineConfig({
  // Relativer Base-Pfad: läuft auf GitHub Pages unter /<repo>/ und lokal unter /.
  base: './',
  // HTTPS=1: selbstsigniertes Zertifikat, damit Online-Spiele im LAN laufen
  // (WebCrypto gibt es nur unter HTTPS oder localhost)
  plugins: [react(), libraryCredits(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  resolve: {
    alias: [
      { find: '@core/sdk', replacement: core('sdk/index.ts') },
      { find: '@core/assets', replacement: core('assets/index.ts') },
      { find: /^@core\/(.*)$/, replacement: core('$1') },
    ],
  },
  test: {
    include: ['core/**/*.test.ts', 'games/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
