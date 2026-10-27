// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

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
    // The lib layer is shared: features and routes may import it, but
    // it never reaches back into them. Type-only imports pass because
    // they carry no runtime dependency.
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/*', '**/features/**', '**/app/*', '**/app/**'],
              message:
                'Shared code must not depend on a feature or a route. Move the shared piece into lib instead.',
              allowTypeImports: true,
            },
          ],
        },
      ],
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

