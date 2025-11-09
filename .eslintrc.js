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
    project: ['tsconfig.json'],
    sourceType: 'module',
  },
  ignorePatterns: [
    'dist/**/*', // Ignore built files.
    'node_modules/**/*', // Ignore node_modules.
    'functions/**/*', // Ignore functions directory (has its own ESLint config).
    'coverage/**/*', // Ignore coverage files.
    'scripts/**/*', // Ignore scripts directory.
    '*.config.js', // Ignore config files.
    '.eslintrc.js', // Ignore this ESLint config file.
    'tsconfig-paths-bootstrap.js', // Ignore bootstrap script.
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
    'require-jsdoc': 'off',
  },
};
