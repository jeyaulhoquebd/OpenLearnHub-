import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, '..');

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, rootDir, '');
  // Firebase Hosting rewrites every path (including /api) to index.html, so a
  // production build without VITE_API_URL silently breaks LearnMate, reviews,
  // bookmarks and reports. Fail the build instead. Set
  // VITE_ALLOW_RELATIVE_API=true only if your host proxies /api itself.
  if (
    command === 'build' &&
    mode === 'production' &&
    !String(env.VITE_API_URL || '').trim() &&
    env.VITE_ALLOW_RELATIVE_API !== 'true'
  ) {
    throw new Error(
      'VITE_API_URL is required for production builds (e.g. https://openlearn-api.onrender.com). ' +
        'Set VITE_ALLOW_RELATIVE_API=true if /api is proxied by your host.'
    );
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      fs: {
        allow: [repoRoot],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('i18next')) return 'i18n';
            if (id.includes('react-router')) return 'router';
            // Charts are only pulled in by the lazy admin dashboard, so keep them
            // out of the shared vendor chunk (and out of the react chunk below).
            if (id.includes('recharts') || id.includes('victory-vendor')) return 'charts';
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            return 'vendor';
          },
        },
      },
    },
  };
});
