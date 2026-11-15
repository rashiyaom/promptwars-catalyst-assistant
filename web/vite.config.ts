import { defineConfig, loadEnv } from 'vite';
import { sarvamMiddleware } from './server/sarvam.ts';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'local-sarvam-speech',
      configureServer(server) {
        const env = loadEnv(mode, resolve(webRoot, '..'), 'SARVAM_');
        server.middlewares.use(
          sarvamMiddleware(
            env.SARVAM_API_KEY ?? '',
            resolve(webRoot, '../.env.sarvam-budget.json'),
          ),
        );
      },
    },
  ],
  envDir: '..',
  build: {
    rollupOptions: {
      input: {
        app: resolve(webRoot, 'index.html'),
        'firebase-messaging-sw': resolve(webRoot, 'src/firebase-messaging-sw.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'firebase-messaging-sw'
            ? 'firebase-messaging-sw.js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
}));
