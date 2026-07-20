import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
    // Base ESLint recommended rules
    eslint.configs.recommended,
    // TypeScript recommended rules
    ...tseslint.configs.recommended,
    // Turns off all ESLint rules that might conflict with Prettier
    eslintConfigPrettier,
    {
        // Global ignores (replaces .eslintignore)
        ignores: ['dist/**', 'node_modules/**'],
    },
    {
        files: ['src/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    }
)