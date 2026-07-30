import { defineConfig } from 'vitest/config';

export default defineConfig({
  // impede o Vite de herdar o postcss.config do repositório raiz
  css: { postcss: {} },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
