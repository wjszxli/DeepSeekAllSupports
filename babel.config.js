module.exports = (api) => {
    api.cache(true);

    const envPreset = [
        '@babel/env',
        {
            modules: false,
            bugfixes: true,
            useBuiltIns: 'usage',
            corejs: { version: require('./package.json').devDependencies['core-js'] },
        },
    ];

    const importPlugin = [
        'import',
        {
            libraryName: 'antd',
            libraryDirectory: 'es',
            style: true,
        },
    ];

    return {
        presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
        plugins: [
            '@babel/plugin-transform-class-properties',
            '@babel/plugin-transform-private-methods',
            '@babel/plugin-transform-private-property-in-object',
            ['@babel/plugin-transform-runtime', { regenerator: true }],
            ['@babel/plugin-proposal-decorators', { decoratorsBeforeExport: true }],
            'lodash',
            importPlugin,
        ],
        env: {
            development: {
                presets: [['@babel/preset-react', { runtime: 'automatic', development: true }]],
                plugins: [require.resolve('react-refresh/babel')],
            },
            production: {
                presets: [['@babel/preset-react', { runtime: 'automatic', development: false }]],
                plugins: ['@babel/plugin-transform-react-constant-elements'],
            },
        },
    };
};
