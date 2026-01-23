/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

// Configure webpack alias for grammar manifests
// This allows the product extension to import @app/grammar-manifests
// which resolves to this application's generated grammar-manifests module
configs[0].resolve = configs[0].resolve || {};
configs[0].resolve.alias = configs[0].resolve.alias || {};
configs[0].resolve.alias['@app/grammar-manifests'] = path.resolve(__dirname, 'src/frontend/grammar-manifests-module.js');

// IMPORTANT: Deduplicate sprotty and inversify to ensure Symbol identifiers match across chunks
// Without this, different chunks may get different Symbol instances, causing DI binding failures
configs[0].resolve.alias['sprotty'] = path.resolve(__dirname, '../../node_modules/sprotty');
configs[0].resolve.alias['sprotty-protocol'] = path.resolve(__dirname, '../../node_modules/sprotty-protocol');
configs[0].resolve.alias['inversify'] = path.resolve(__dirname, '../../node_modules/inversify');

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
configs[0].module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

// serve favico from root and grammar logos
// @ts-ignore
configs[0].plugins.push(
    // @ts-ignore
    new CopyWebpackPlugin({
        patterns: [
            {
                context: path.resolve('.', '..', '..', 'applications', 'browser', 'ico'),
                from: '**'
            },
            {
                context: path.resolve('.', '..', '..', 'applications', 'browser', 'resources'),
                from: '**',
                to: 'resources'
            },
            // Copy grammar logos to assets/logos/ directory for browser caching
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