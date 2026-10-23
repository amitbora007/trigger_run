import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          vendor_recharts: ['recharts'],
          vendor_react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    env: {
      VITE_SUPABASE_URL: 'https://ejeugpfpstgfumbkvjon.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-vitest',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
