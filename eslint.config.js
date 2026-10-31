// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    // Build output and generated projects: the exported web bundle (dist/, and dist-web/ where a script
    // puts it) is minified React Native for the browser, not this repository's source.
    ignores: ['dist/*', 'dist-web/*', 'android/*', 'ios/*', 'coverage/*', 'shots/*', 'build-out/*'],
  },
  {
    // Tests and their helpers run under Jest.
    files: ['**/__tests__/**', 'jest.setup.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
]);
