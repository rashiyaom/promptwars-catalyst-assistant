import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  build: {
    rollupOptions: {
      input: {
        app: resolve(webRoot, 'index.html'),
        'firebase-messaging-sw': resolve(webRoot, 'src/firebase-messaging-sw.ts'),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === 'firebase-messaging-sw'
          ? 'firebase-messaging-sw.js'
          : 'assets/[name]-[hash].js',
      },
    },
  },
});
