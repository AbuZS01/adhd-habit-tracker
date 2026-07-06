import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['public/sw.js', 'drizzle/**', '.next/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Enforced as a hard security rule (SR-2): no dynamic HTML injection.
      'react/no-danger': 'error',
    },
  },
];

export default eslintConfig;
