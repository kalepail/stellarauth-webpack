const CopyWebpackPlugin = require('copy-webpack-plugin');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const commonPaths = require('./common-paths');
const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    path: commonPaths.outputPath,
    filename: '[name].[hash].js'
  },
  module: {
    rules: [{
      enforce: 'pre',
      test: /\.s?css$/,
      exclude: /(node_modules)/,
      loader: 'import-glob'
    },{
      test: /\.js$/,
      exclude: /(node_modules)/,
      loader: 'babel-loader',
    },{
      test: /\.html$/,
      exclude: /node_modules/,
      use: {
        loader: 'html-loader',
        options: {
          root: path.resolve(__dirname, 'images'),
          interpolate: true,
          attrs: ['link:href', 'img:src']
        }
      }
    },{
      test: /\.(jpe?g|png|gif|svg|gif)$/,
      exclude: /node_modules/,
      use: [{
        loader:'file-loader',
        options: {
          name: '[name].[ext]?hash=[hash]'
        }
      },{
        loader: 'image-webpack-loader',
        query: {}
      }]
    }]
  },
  plugins: [
    new HardSourceWebpackPlugin(),
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({
      template: './index.html',
      alwaysWriteToDisk: true
    }),
    new CopyWebpackPlugin([
      './CNAME',
      './CORS',
      './robots.txt'
    ])
  ]
}
