const tseslint = require('typescript-eslint');
const angular = require('@angular-eslint/eslint-plugin');
const angularTemplate = require('@angular-eslint/eslint-plugin-template');

module.exports = tseslint.config(
  {
    ignores: ['**/*.js']
  },
  {
    files: ['**/*.ts'],
    extends: [
      'plugin:@angular-eslint/recommended'
    ],
    rules: {}
  },
  {
    files: ['**/*.html'],
    extends: ['plugin:@angular-eslint/template/recommended'],
    rules: {}
  }
);
