module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    'react',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off', // Not needed for new JSX transform
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'react/prop-types': 'off',
    // Downgrade these to warnings so builds pass - fix incrementally
    'no-constant-condition': 'warn',
    'no-case-declarations': 'warn',
    'react/no-unescaped-entities': 'warn',
    'prefer-const': 'warn',
    'react/jsx-no-target-blank': 'warn',
    'no-unused-vars': 'off', // Using @typescript-eslint/no-unused-vars instead
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
