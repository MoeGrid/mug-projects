import fs from 'fs'
import path from 'path'
import { defineConfig } from '@tarojs/cli'

import devConfig from './dev'
import prodConfig from './prod'

// 读取小程序 package.json 版本号
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'))
const WEAPP_APPID = process.env.MINI_APPID || 'wx31e78bc38118667b'

// 智能探测微信 CI 上传私钥路径 (优先环境变量，其次根目录或 config 目录下的 key 文件)
function resolvePrivateKeyPath() {
  if (process.env.MINI_KEY_PATH && fs.existsSync(process.env.MINI_KEY_PATH)) {
    return process.env.MINI_KEY_PATH
  }
  const candidates = [
    path.resolve(__dirname, '..', `private.${WEAPP_APPID}.key`),
    path.resolve(__dirname, '..', 'private.key'),
    path.resolve(__dirname, `private.${WEAPP_APPID}.key`),
    path.resolve(__dirname, 'private.key'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return path.resolve(__dirname, '..', `private.${WEAPP_APPID}.key`)
}

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig = {
    projectName: 'mug-app',
    date: '2026-11-7',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    alias: {
      '@': path.resolve(__dirname, '..', 'src')
    },
    plugins: [
      [
        '@tarojs/plugin-mini-ci',
        {
          weapp: {
            appid: WEAPP_APPID,
            privateKeyPath: resolvePrivateKeyPath(),
          },
          version: process.env.MINI_VERSION || pkg.version || '1.0.0',
          desc: process.env.MINI_DESC || `自动部署体验版 (${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`,
        },
      ],
    ],
    defineConstants: {
    },
    copy: {
      patterns: [
        { from: 'src/static', to: 'dist/static' }
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: 'vite',
    mini: {
      debugReact: true,
      postcss: {
        htmltransform: {
          enable: false
        },
        pxtransform: {
          enable: true,
          config: {

          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',

      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }
  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
