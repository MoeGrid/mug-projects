# MUG & TCG 现代化架构与 API v1 规范文档

## 一、概述

本版本是没有任何历史包袱的全新一代 MUG（音游街机投币）与 TCG（卡牌桌游）双核心架构。彻底摒弃了老旧 PHP 遗留的黑话命名与扁平混杂风格，全面采用 **领域驱动设计（DDD）** 与 **RESTful API v1** 规范。

---

## 二、六大业务领域与路由映射

基础接口统一以 `/api/v1/` 为命名空间。

### 1. 🔐 身份认证模块（Auth - `/api/v1/auth`）
* **`POST /api/v1/auth/wechat-login`**
  - **功能**：微信静默登录
  - **入参**：`{ code: string }`
  - **返回**：`{ token, id, open_id, nickname, avatar, is_admin, is_ban, ban_msg }`

### 2. 👤 用户资料模块（User - `/api/v1/user`）
* **`GET /api/v1/user/profile`**
  - **功能**：获取当前登录用户详情
  - **请求头**：`Authorization: Bearer <token>`
* **`PUT /api/v1/user/profile`**
  - **功能**：更新昵称与头像
  - **入参**：`{ nickname: string, avatar: string }`

### 3. 💳 资产与支付模块（Wallet - `/api/v1/wallet`）
* **`GET /api/v1/wallet/assets`**
  - **功能**：获取用户资产（余额、音游天数 `arcade_days`、TCG天数 `tcg_days`）
* **`GET /api/v1/wallet/packages`**
  - **功能**：获取充值特惠套餐活动列表
* **`POST /api/v1/wallet/orders/recharge`**
  - **功能**：自定义金额充值下单
  - **入参**：`{ amount: number }`
  - **返回**：微信支付 JSAPI paySign 唤起参数
* **`POST /api/v1/wallet/orders/package`**
  - **功能**：购买特定特惠充值套餐
  - **入参**：`{ packageId: number }`
  - **返回**：微信支付 JSAPI paySign 唤起参数
* **`GET /api/v1/wallet/transactions`**
  - **功能**：分页查询钱包流水账单与投币明细
  - **参数**：`page=1&rows=20`
* **`POST /api/v1/wallet/wechat-pay/notify`**
  - **功能**：微信支付异步结果安全回调（内部进行微信公钥验签与 AES-GCM 解密）
  - *注：保留了 `/wepay/callback` 兼容通道*

### 4. 🕹️ 音游街机模块（Arcade - `/api/v1/arcade`）
* **`GET /api/v1/arcade/devices`**
  - **功能**：获取音游机台分组与机台设备列表
* **`POST /api/v1/arcade/coins/remote-insert`**
  - **功能**：远程 MQTT 脉冲投币
  - **入参**：`{ deviceId: number }`
* **`POST /api/v1/arcade/coins/ble-consume`**
  - **功能**：BLE 蓝牙直连投币上报结算
  - **入参**：`{ deviceId: number }`

### 5. 🎴 卡牌与桌游专区模块（TCG - `/api/v1/tcg`）
* **`GET /api/v1/tcg/passes/options`**
  - **功能**：获取 TCG 通行证套餐配置（天卡 ¥15、月卡 ¥180）
* **`GET /api/v1/tcg/events`**
  - **功能**：获取近期 TCG 赛事与桌游活动列表

### 6. 📁 通用能力模块（Common - `/api/v1/common`）
* **`POST /api/v1/common/upload`**
  - **功能**：通用图片上传（支持头像等），存储在 `tmp/`
  - **表单参数**：`image` 或 `file`（Multipart）
  - **返回**：相对文件路径
* **静态资源访问**：
  - `GET /storage/*` $\rightarrow$ 映射到环境变量配置的 `STORAGE_ROOT` 目录

### 7. 🛠️ 运营管理模块（Admin - `/api/v1/admin`）
* **`GET /api/v1/admin/users`**
  - **功能**：分页搜索用户列表（支持关键字、手机号、QQ、昵称）
  - **参数**：`keyword=&page=1&rows=20`
* **`GET /api/v1/admin/users/:id`**
  - **功能**：获取指定用户详细资料
* **`PATCH /api/v1/admin/users/:id`**
  - **功能**：修改用户属性（管理员身份、封禁、备注等）
* **`POST /api/v1/admin/users/:id/adjust-balance`**
  - **功能**：管理员手动调账（加减余额或变更有效天数，彻底修复历史拼写错误）
  - **入参**：`{ type: 1 | 2, num: number }`

---

## 三、工程结构对照

### 服务端结构（`packages/server/src/` - 纯原生 JavaScript ES Module）
> **无需任何构建/编译步骤（无 tsc、无 dist）**，直接使用原生 Node.js ESM 运行，随改随生效。

```text
packages/server/src/
├── config.js               # 集中环境变量与配置
├── index.js                # HTTP 与 MQTT 服务启动入口
├── app.js                  # 全新架构中间件编排与模块装载
├── db/
│   └── client.js           # MySQL 连接池与 Kysely 实例
├── models/                 # 领域数据模型层
├── services/               # 微信登录/支付/MQTT/雪花算法服务
├── utils/                  # 金额计算、时间处理、响应包装、校验等
└── modules/                # 六大高内聚领域模块
    ├── auth/               # 微信静默登录 (auth.routes.js)
    ├── user/               # 用户资料 (user.routes.js)
    ├── wallet/             # 钱包资产、充值下单、微信支付通知 (wallet.routes.js)
    ├── arcade/             # 街机分组与投币指令 (arcade.routes.js)
    ├── tcg/                # 卡牌通行证与赛事活动（新增）(tcg.routes.js)
    ├── common/             # 通用文件上传 (common.routes.js)
    └── admin/              # 运营管理与安全调账 (admin.routes.js)
```

#### 运行与部署命令
* **本地热重载开发**：`pnpm dev:server`（底层执行 `node --watch src/index.js`）
* **生产启动**：`pnpm start` 或直接 `node src/index.js`（不再需要 `build`）

### 小程序 API 结构（`packages/miniapp/src/api/`）
```text
packages/miniapp/src/api/
├── client.js               # 核心请求拦截器与 401 静默重试机制
├── auth.js                 # 登录认证
├── user.js                 # 用户资料
├── wallet.js               # 钱包资产、套餐、充值、账单
├── arcade.js               # 街机列表、MQTT 投币、BLE 投币
├── tcg.js                  # TCG 通行证与活动（新增）
├── common.js               # 上传与资源 URL 解析 (uploadUrl)
├── admin.js                # 管理后台
└── index.js                # 统一模块聚合导出出口
```
