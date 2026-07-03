import AntdDayjsWebpackPlugin from 'antd-dayjs-webpack-plugin';
import browserslist from 'browserslist';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import lightningCss from 'lightningcss';
import TerserPlugin from 'terser-webpack-plugin';
import webpack, { BannerPlugin } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import merge from 'webpack-merge';

import pkg from '../../package.json';
import { __DEV__, COPYRIGHT, ENABLE_ANALYZE } from '../utils/constants';
import { resolveSrc } from '../utils/path';
import commonConfig from './webpack.common';

const prodConfig = merge(commonConfig, {
    mode: 'production',
    plugins: [
        new BannerPlugin({
            banner: COPYRIGHT,
            raw: true,
        }),
        new ForkTsCheckerWebpackPlugin({
            typescript: {
                memoryLimit: 1024 * 2,
                configFile: resolveSrc('tsconfig.json'),
                profile: ENABLE_ANALYZE,
            },
        }),
        new webpack.ids.HashedModuleIdsPlugin({
            hashFunction: 'sha256',
            hashDigest: 'hex',
            hashDigestLength: 20,
        }),
        new AntdDayjsWebpackPlugin(),
    ],
    optimization: {
        splitChunks: {
            // Firefox 解析器对非二进制 JS 文件有 5MB 上限，留足余量强制拆包
            maxSize: 4 * 1024 * 1024,
            minSize: 50 * 1024,
            chunks: 'all',
            cacheGroups: {
                // 保持 react/react-dom 的高优先级 vendor
                vendor: {
                    test: /[/\\]node_modules[/\\](react|react-dom)[/\\]/,
                    name: 'vendor',
                    chunks: 'all',
                    priority: 30,
                    reuseExistingChunk: true,
                },
                // 其它 node_modules 统一拆包，避免重复打进每个 entry
                vendors: {
                    test: /[/\\]node_modules[/\\]/,
                    priority: 20,
                    reuseExistingChunk: true,
                },
                // 项目内公共模块复用
                common: {
                    minChunks: 2,
                    priority: 10,
                    reuseExistingChunk: true,
                },
            },
        },
        minimize: true,
        minimizer: [
            new TerserPlugin({
                minify: TerserPlugin.swcMinify,
                parallel: true,
                extractComments: false,
            }),
            new CssMinimizerPlugin({
                minify: CssMinimizerPlugin.lightningCssMinify,
                minimizerOptions: {
                    // @ts-expect-error webpack type define wrong
                    targets: lightningCss.browserslistToTargets(browserslist(pkg.browserslist)),
                    preset: [
                        'default',
                        {
                            discardComments: { removeAll: true },
                        },
                    ],
                },
            }),
        ],
    },
});

if (ENABLE_ANALYZE) {
    prodConfig.plugins!.push(new BundleAnalyzerPlugin());
}

export default prodConfig;
