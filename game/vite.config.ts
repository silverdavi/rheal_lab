import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env from parent directory (root .env) and current directory
  const rootEnv = loadEnv(mode, resolve(__dirname, '..'), '');
  const localEnv = loadEnv(mode, __dirname, '');
  
  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      // Expose OPENAI_API_KEY as VITE_OPENAI_API_KEY for the app
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(
        localEnv.VITE_OPENAI_API_KEY || rootEnv.OPENAI_API_KEY || ''
      ),
    },
    server: {
      port: 3000,
      open: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false, // Disable for production
      minify: 'terser',
    },
    base: './', // Relative paths for static hosting
  };
});

