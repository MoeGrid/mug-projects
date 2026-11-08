# MUG Project (Monorepo)

包含音游街机投币小程序前端与 Node.js 服务端后端的聚合工程。

## 目录结构

```text
mug-project/
├── packages/
│   ├── miniapp/      # 微信小程序前端 (Taro 4 + React 18 + Vite + SCSS)
│   └── server/       # 服务端后端 (Hono + Kysely + MySQL + TSX)
├── package.json      # 根工程脚本管理
├── pnpm-workspace.yaml # pnpm workspaces 配置
└── README.md
```

## 常用命令

在根目录下运行：

### 安装依赖
```bash
pnpm install
```

### 开发调试
- 启动小程序开发监听：
  ```bash
  pnpm dev:miniapp
  # 或快捷命令
  pnpm dev:app
  ```
- 启动后端服务热重载：
  ```bash
  pnpm dev:server
  ```

### 生产运行（线上版）
- 一键构建并启动后端生产服务：
  ```bash
  pnpm start
  # 或
  pnpm start:server
  ```
- 跳过构建直接运行（已有 dist）：
  ```bash
  pnpm serve:server
  ```

### 生产打包构建
- 构建小程序：
  ```bash
  pnpm build:miniapp
  ```
- 编译后端 TypeScript：
  ```bash
  pnpm build:server
  ```

## 微信开发者工具设置
导入项目时，项目目录可直接选择：
`c:\Users\aiyah\WebstormProjects\mug-project\packages\miniapp`
或者在微信开发者工具中指定小程序的产物目录 `packages/miniapp/dist`。
