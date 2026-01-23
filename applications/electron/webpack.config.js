/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

// Configure webpack alias for grammar manifests
// This allows the product extension to import @app/grammar-manifests
// which resolves to this application's generated grammar-manifests module
configs[0].resolve = configs[0].resolve || {};
configs[0].resolve.alias = configs[0].resolve.alias || {};
configs[0].resolve.alias['@app/grammar-manifests'] = path.resolve(__dirname, 'src/frontend/grammar-manifests-module.js');

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
configs[0].module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

/**
 * Do no run TerserPlugin with parallel: true
 * Each spawned node may take the full memory configured via NODE_OPTIONS / --max_old_space_size
 * In total this may lead to OOM issues
 */
if (nodeConfig.config.optimization) {
    nodeConfig.config.optimization.minimizer = [
        new TerserPlugin({
            parallel: false,
            exclude: /^(lib|builtins)\//,
            terserOptions: {
                keep_classnames: /AbortSignal/
            }
        })
    ];
}
for (const config of configs) {
    config.optimization = {
        minimizer: [
            new TerserPlugin({
                parallel: false
            })
        ]
    };
}

// Copy grammar logos to assets/logos/ directory for browser caching
// @ts-ignore
configs[0].plugins.push(
    // @ts-ignore
    new CopyWebpackPlugin({
        patterns: [
            {
                from: path.resolve(__dirname, '../../packages/grammar-definitions/*/src/logo.svg'),
                to({ absoluteFilename }) {
                    const grammarName = absoluteFilename.split('/grammar-definitions/')[1].split('/')[0];
                    return `assets/logos/${grammarName}.svg`;
                },
                noErrorOnMissing: true
            }
        ]
    })
);

module.exports = [
    ...configs,
    nodeConfig.config
];