// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Spacing ownership (docs/adr/0012): children never declare
      // bottom or right margins; containers own the gaps.
      'no-restricted-syntax': [
        'warn',
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
    ignores: ['dist/*'],
  },
]);

