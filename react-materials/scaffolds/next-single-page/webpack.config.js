const webpack = require('webpack');
const path = require('path');
const globby = require('globby');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const SimpleProgressPlugin = require('webpack-simple-progress-plugin');
const ThemePlugin = require('@alifd/next-theme-webpack-plugin');
const os = require('os');
const HappyPack = require('happypack');
const colors = require('colors');

const happyThreadPool = HappyPack.ThreadPool({ size: os.cpus().length });
const DEV = process.env.DEV;
const LIVELOAD = process.env.LIVELOAD;
const SINGLE_PAGE = process.env.SINGLE_PAGE;
const cwd = process.cwd();

const entry = {};

// 获取 package.json 中的主题配置文件
let theme = '';
try {
  const pkg = require('./package.json');
  if (pkg && pkg.buildConfig && pkg.buildConfig.theme) {
    theme = pkg.buildConfig.theme;
  } else {
    const fieConfig = require('./fie.config.js');
    if (fieConfig && fieConfig.toolkitConfig && fieConfig.toolkitConfig.theme) {
      theme = fieConfig.toolkitConfig.theme;
      console.warn(`fie中的主题包配置已迁移, 请在 package.json 中配置
      buildConfig:{
        theme: '@alife/dpl-主题包名'
      }`);
    }
  }
} catch (e) {
  console.error(e);
  console.log(`请在 package.json 中配置
  buildConfig:{
    theme: '@alife/dpl-主题包名'
  }`);
}

const scssLoader = [
  {
    loader: 'css-loader',
    options: {
      minimize: true,
      sourceMap: false,
    },
  },
  {
    loader: 'postcss-loader',
    options: {
      indent: 'postcss',
      plugins: () => [
        require('autoprefixer')(),
      ],
      sourceMap: false,
    },
  },
  {
    loader: 'sass-loader',
    options: {
      sourceMap: false,
    },
  },
];

if (theme) {
  console.log(`NOTICE: 注入 ${theme}/variables.scss 到每个 scss 文件`.green);
  scssLoader.push({
    loader: '@alifd/next-theme-loader',
    options: {
      theme,
      // base: '@alifd/next'
    },
  });
}

const config = {
  mode: DEV ? 'development' : 'production',
  context: cwd,
  entry: {
    'index': ['./src/index.jsx']
  },
  output: {
    path: path.resolve(process.env.BUILD_DEST || 'build'),
    publicPath: 'build',
    filename: '[name].js',
    chunkFilename: '[name].js',
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      components: path.join(__dirname, 'src/components'),
      layouts: path.join(__dirname, 'src/layouts'),
      utils: path.join(__dirname, 'src/utils'),
      pages: path.join(__dirname, 'src/pages'),
    },
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'happypack/loader',
            options: {
              id: 'js',
            },
          },
        ],
      },
      {
        test: /\.scss/,
        use: [
          MiniCssExtractPlugin.loader,
          'happypack/loader?id=scss',
        ],
      },
    ],
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM',
    'moment': 'moment',
  },
  plugins: [
    new HappyPack({
      debug: true,
      id: 'js',
      loaders: [{
        path: 'babel-loader',
        query: {
          cacheDirectory: true,
        },
      }],
      threadPool: happyThreadPool,
    }),

    new HappyPack({
      id: 'scss',
      threadPool: happyThreadPool,
      loaders: scssLoader,
    }),
    
    new ThemePlugin({ theme }),

    new MiniCssExtractPlugin({
      filename: '[name].bundle.css',
      chunkFilename: '[name].bundle.css',
    }),
    // 允许错误不打断程序
    new webpack.NoEmitOnErrorsPlugin(),
    // 美化打包进度条
    new SimpleProgressPlugin(),
    // 环境变量定义
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(DEV ? 'development' : 'production'),
      },
      __DEV__: JSON.stringify(JSON.parse(DEV ? 'true' : 'false')),
    }),
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
        },
      },
    },
  },
};

if ((LIVELOAD && LIVELOAD !== 0) && LIVELOAD !== '0') {
  Object.keys(config.entry).forEach((key) => {
    config.entry[key].unshift('webpack-dev-server/client?/');
  });
}

// 发布状态
if (!DEV) {
  config.plugins.push(
    new OptimizeCssAssetsPlugin({
      assetNameRegExp: /\.bundle\.css$/g,
      cssProcessor: require('cssnano'),
      cssProcessorOptions: { discardComments: { removeAll: true } },
      canPrint: true,
    })
  );
} else {
  config.devServer = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    stats: {
      colors: true,
      chunks: false,
      children: false,
      modules: false,
      chunkModules: false,
    }
  };
  config.devtool = 'source-map';
}

module.exports = config;
