import js from '@eslint/js';
import globals from 'globals';

export default [
	{
		ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
		linterOptions: {
			reportUnusedDisableDirectives: 'error',
		},
	},
	{
		...js.configs.recommended,
		files: ['src/**/*.js', 'examples/**/*.js', 'test/**/*.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.node,
			},
		},
		rules: {
			...js.configs.recommended.rules,
			// modern baseline: safety + readability without legacy micromanagement
			curly: ['error', 'multi-line'],
			eqeqeq: ['error', 'always'],
			'no-implicit-coercion': 'error',
			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'no-var': 'error',
			'object-shorthand': ['error', 'always'],
			'prefer-const': 'error',
			'prefer-template': 'error',
		},
	},
];
