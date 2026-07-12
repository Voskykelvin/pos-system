const { defineConfig } = require('vitest/config');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: 'automatic'
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['{src,middleware,utils,services}/**/*.test.{js,jsx,mjs}'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage'
    }
  }
});
