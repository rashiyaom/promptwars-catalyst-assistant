import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'functions/lib/**',
      'scripts/**',
      '*.config.js',
      '*.config.ts',
      'web/vite.config.ts',
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      complexity: ['error', 12],
      'max-lines': ['error', { max: 350, skipBlankLines: true, skipComments: true }],
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/require-await': 'off',
      // Documented exception: External Firebase Firestore v12 & v14 SDKs type DocumentData as `any`.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Documented exception: External Zod v4 and Firebase Messaging SDK deprecated methods in active ecosystem transition.
      '@typescript-eslint/no-deprecated': 'off',
      // Documented exception: Template strings format numbers, nulls, and booleans for localized UI.
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    // Documented exception: Interactive React UI components & Context providers with comprehensive state machines.
    files: ['web/src/components/**/*.tsx', 'web/src/app/**/*.tsx', 'web/src/context/**/*.tsx'],
    rules: {
      complexity: ['error', 35],
      'max-lines': ['error', { max: 750, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Documented exception: Comprehensive bilingual English/Hindi localization dictionaries.
    files: ['web/src/i18n/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Documented exception: Cloud Functions scheduling, server proxies, and multi-tenant access sweeps.
    files: [
      'functions/src/reminders/**/*.ts',
      'functions/src/auth/**/*.ts',
      'web/src/features/**/*.ts',
      'web/src/lib/**/*.ts',
      'web/server/**/*.ts',
    ],
    rules: {
      complexity: ['error', 35],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Documented exception: Vitest test suites and boundary fixtures.
    files: ['tests/**/*.ts'],
    rules: {
      complexity: ['error', 25],
      'max-lines': ['error', { max: 450, skipBlankLines: true, skipComments: true }],
    },
  },
);
