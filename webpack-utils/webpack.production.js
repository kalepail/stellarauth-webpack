const ExtractTextWebpackPlugin = require('extract-text-webpack-plugin');
const UglifyJsWebpackPlugin = require('uglifyjs-webpack-plugin');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const commonPaths = require('./common-paths');

const extractSCSS = new ExtractTextWebpackPlugin('[name].[hash].css');

const config = {
  devtool: 'source-map',
  mode: 'production',
  output: {
    publicPath: commonPaths.publicPath
  },
  module: {
    rules: [{
      test: /\.scss$/,
      use: extractSCSS.extract({
        use: [
          {loader: 'css-loader', options: {importLoaders: 1}},
          'postcss-loader',
          'sass-loader'
        ],
        fallback: 'style-loader'
      }),
      exclude: /node_modules/
    }]
  },
  plugins: [
    extractSCSS,
    new UglifyJsWebpackPlugin({
      sourceMap: true
    }),
    new CompressionWebpackPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: /\.(js|html|css)$/,
      threshold: 10240,
      minRatio: 0.8
    })
  ]
}

module.exports = config;
