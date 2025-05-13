module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*', // Ignore generated files.
    '/fix-imports.js', // Ignore the fix-imports script.
    '/coverage/**/*', // Ignore coverage files.
  ],
  plugins: [
    '@typescript-eslint',
    'import',
  ],
  rules: {
    'quotes': ['error', 'single'],
    'max-len': ['error', { code: 120 }],
    'import/no-unresolved': 0,
    'indent': 'off',
    'object-curly-spacing': 'off',
    'valid-jsdoc': 'off',
    'operator-linebreak': 'off',
    '@typescript-eslint/no-namespace': 'off',
  },
};
