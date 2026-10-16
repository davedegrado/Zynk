// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'ios/*', 'android/*'],
  },
  {
    // jest.mock() must run before the mocked modules are imported.
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: { 'import/first': 'off' },
  },
]);
