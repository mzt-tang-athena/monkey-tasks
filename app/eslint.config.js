// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const checkFile = require('eslint-plugin-check-file');
const fs = require('node:fs');
const path = require('node:path');

// Each folder in src/features gets its own zone, so a new feature is
// fenced off with no config change.
const features = fs.readdirSync(path.join(__dirname, 'src/features'));
const shared = ['components', 'hooks', 'lib', 'stores', 'theme', 'types', 'utils'].map(
  (dir) => `./src/${dir}`,
);

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Spacing ownership (docs/adr/0012): children never declare
      // bottom or right margins; containers own the gaps. Ticket 0054
      // widens it to top, left and vertical margins.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Property[key.name=/^margin(Bottom|Right)$/] , Property[key.name='marginBottom'] , Property[key.name='marginRight']",
          message:
            'Spacing ownership: do not use marginBottom/marginRight in styles. The container owns the gaps (see docs/adr/0012-spacing-ownership-rule.md).',
        },
      ],
    },
  },
  {
    // Import boundaries (ADR 0039): code flows from the shared folders
    // to the features to the routes, and type-only imports count. The
    // node resolver from eslint-config-expo cannot read the `@/` alias,
    // and the zones then skip those imports without a word, so the
    // TypeScript resolver comes first.
    files: ['src/**/*.{ts,tsx}'],
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            ...features.map((name) => ({
              target: `./src/features/${name}`,
              from: './src/features',
              except: [`./${name}`],
              message: 'A feature never imports another feature (ADR 0039).',
            })),
            {
              target: './src/features',
              from: './src/app',
              message: 'A feature never imports a route (ADR 0039).',
            },
            {
              target: shared,
              from: ['./src/features', './src/app'],
              message: 'Shared code never imports a feature or a route (ADR 0039).',
            },
            {
              target: ['./src/lib', './src/utils', './src/types', './src/theme'],
              from: ['./src/components', './src/hooks', './src/stores'],
              message: 'lib, utils, types and theme sit at the bottom (ADR 0039).',
            },
          ],
        },
      ],
    },
  },
  {
    // File and folder names use kebab-case (ADR 0039). Route files
    // under src/app keep the names expo-router needs.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/**'],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { 'src/**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { 'src/!(app)/**/': 'KEBAB_CASE' }],
    },
  },
  {
    // A test declares its vi.mock calls first and imports the modules
    // they replace after them, so the reader sees the mocks first.
    // Vitest hoists the mocks either way.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'import/first': 'off',
    },
  },
  {
    // The Playwright suite holds no React code. Its fixtures hand
    // their value on through a callback named `use`, which the hooks
    // rule would read as React's `use`.
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    ignores: ['dist/*', 'e2e/playwright-report/*', 'e2e/test-results/*'],
  },
]);

