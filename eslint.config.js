import js from '@eslint/js'
import tseslint from 'typescript-eslint'

const moneyGuardrails = [
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message:
      'Money is integer minor units. Use toMinor from @quickerpay/money instead of parseFloat.',
  },
  {
    selector: "MemberExpression[property.name='toFixed']",
    message:
      'Money is integer minor units. Use fromMinor from @quickerpay/money instead of toFixed.',
  },
  {
    selector: "NewExpression[callee.name=/^(Decimal|BigNumber)$/]",
    message: 'Money is integer minor units in BIGINT columns. Decimal libraries are not used.',
  },
  {
    selector: "Identifier[name=/^(banker|bankerId|bankerCode|bankerUpi|bankerUPI)$/]",
    message: 'Banker is a banned word. Use Admin. See quickerpay-api docs/00_START_HERE.md section 5.',
  },
  {
    selector: "Identifier[name=/^(wallet|walletBalance|walletTransaction)$/]",
    message:
      'There is no wallet. Balances are derived from the append-only ledger.',
  },
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': ['error', ...moneyGuardrails],
    },
  },
)
