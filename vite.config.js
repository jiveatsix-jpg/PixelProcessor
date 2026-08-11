import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  resolve: {
    alias: {
      '/js': resolve(__dirname, 'src/js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    root: '.',
    include: ['tests/**/*.test.js'],
    alias: {
      '/js': resolve(__dirname, 'src/js'),
    },
    setupFiles: ['./tests/setup.js'],
  },
});
