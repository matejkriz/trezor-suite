module.exports = {
    extends: '../../.eslintrc.js',
    parserOptions: {
        project: './tsconfig.json',
    },
    rules: {
        'no-bitwise': 'off', // airbnb-base: used in hardending
        'prefer-object-spread': 'off', // prefer Object.assign
        'no-console': 'warn',
    },
};
