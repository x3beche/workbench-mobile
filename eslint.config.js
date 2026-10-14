// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'coverage/*', 'shots/*'],
  },
  {
    // Tests and their helpers run under Jest.
    files: ['**/__tests__/**', 'jest.setup.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
]);
