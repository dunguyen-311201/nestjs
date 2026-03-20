import { config } from '@repo/eslint-config/base'

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: [
      '**/*.spec.ts',
      '**/*.test.ts',
      'src/test-utils.ts',
      'src/setup-tests.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
