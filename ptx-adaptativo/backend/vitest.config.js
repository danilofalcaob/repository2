import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: { postcss: {} }, // impede a resolução do postcss.config da raiz do repositório
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
