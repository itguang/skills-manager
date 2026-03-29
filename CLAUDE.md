# Skills Manager - uTools 插件项目

## 项目简介

Skills Manager 是一个用于管理本地已安装 skills 的 uTools 插件，提供可视化 UI 界面来管理 skill。

## 文档基线

以下 uTools 开发信息已于 `2026-03-25` 按官方文档核对，后续开发优先参考这些规则与链接：

- 快速开始: https://www.u-tools.cn/docs/developer/basic/getting-started.html
- 第一个插件应用: https://www.u-tools.cn/docs/developer/basic/first-plugin.html
- 调试插件应用: https://www.u-tools.cn/docs/developer/basic/debug-plugin.html
- plugin.json 配置: https://www.u-tools.cn/docs/developer/information/plugin-json.html
- preload 预加载脚本: https://www.u-tools.cn/docs/developer/information/preload.html
- API 总览: https://www.u-tools.cn/docs/developer/docs.html
- 事件 API: https://www.u-tools.cn/docs/developer/utools-api/events.html
- 窗口 API: https://www.u-tools.cn/docs/developer/utools-api/window.html
- 复制 API: https://www.u-tools.cn/docs/developer/utools-api/copy.html
- 输入 API: https://www.u-tools.cn/docs/developer/utools-api/input.html
- 系统 API: https://www.u-tools.cn/docs/developer/utools-api/system.html
- 本地数据库 API: https://www.u-tools.cn/docs/developer/utools-api/db.html
- 动态指令 API: https://www.u-tools.cn/docs/developer/api-reference/utools/features.html
- dbStorage: https://www.u-tools.cn/docs/developer/api-reference/db/db-storage.html
- dbCryptoStorage: https://www.u-tools.cn/docs/developer/api-reference/db/db-crypto-storage.html

## uTools 运行模型

- uTools 插件本质是 `Node.js 本地能力 + Web 前端页面`。
- 渲染层通过 `window.utools.*` 调官方 API。
- 本地文件、Node.js、Electron 渲染进程能力应放在 preload 中，通过 `window.services.*` 暴露给前端。
- 当前项目已采用该模式：`public/preload/services.js` 注入 `window.services`，Vue 组件只消费注入后的能力。
- 当前项目入口路由方式是：在 `src/App.vue` 中监听 `window.utools.onPluginEnter`，根据 `action.code` 切换功能组件；新增 feature 时应保持这一模式。

## 开发命令

```bash
# 开发环境启动
npm run dev

# 生产构建（输出到 dist/ 目录）
npm run build
```

注意：

- 打包为 uTools 插件时，仅打包 `dist/` 文件夹，不要打包整个项目根目录。
- uTools 开发模式支持入口 URL，因此 `plugin.json` 中可配置 `development.main` 指向 Vite 地址。
- `preload` 代码改动通常不能像前端那样热更新；开发时建议在 uTools 开发工具里开启“退出到后台立即结束运行”。

## 代码规范

### 前端代码

#### 技术栈

- Vue 3 Composition API (`<script setup>`)
- TypeScript（使用 `<script lang="ts" setup>`）
- Vite 构建工具
- uTools API 类型提示：`utools-api-types`

#### 组件结构

```vue
<script lang="ts" setup>
  import { ref, watch, onMounted } from 'vue'

  const props = defineProps({ enterAction: Object })
  const state = ref('')

  onMounted(() => { /* init */ })

  watch(() => props.enterAction, (val) => { /* handle */ }, { immediate: true })
</script>

<template>
  <div class="component-name"><!-- template --></div>
</template>

<style scoped>
  /* styles */
</style>
```

#### 命名规范

- 组件文件/目录：`PascalCase`（如 `Hello/index.vue`、`App.vue`）
- 变量/函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 类名：`PascalCase`

#### 排版要求

- 前端 UI 默认强制优先节省排版空间；同一信息密度能在一行内完成时，不要擅自拆到多行。
- 优先通过截断、限制宽度、压缩间距、保持操作区贴边等方式解决空间问题，而不是增加垂直层级。
- 对技能列表卡片，`skill-name`、版本、作者、标签、右侧操作按钮应优先保持同一行展示；未经明确要求，不要改成两行布局。
- 操作按钮容器默认靠右对齐展示（含小屏场景）；未经明确要求，不要左对齐操作区。

#### 导入顺序

1. Vue imports (`ref`、`watch`、`reactive` 等)
2. 第三方库
3. 组件导入
4. 类型导入
5. 工具函数

#### API 调用约束

- uTools API: `window.utools.*`
- Node.js 服务: `window.services.*`（通过 preload 注入）
- 不要在 Vue 组件中直接 `require('node:*')` 或直接依赖 Electron。
- 若能力属于文件系统、进程、路径、网络、原生调用，优先在 preload 封装后再给前端使用。

#### 错误处理

- 用 `try-catch` 包装可能失败的操作。
- 失败时优先使用 `window.utools.showNotification()` 给出明确提示。
- 涉及文件、数据库写入时，要同时考虑空值、权限、路径不存在、版本冲突等异常。

### Preload 代码

#### 规范要求

- 使用 CommonJS 规范（`require`）
- 必须清晰可读，不可打包、压缩、混淆
- 位于 `public/preload/` 目录，不参与 Vite 构建
- 官方文档说明 preload 运行在独立预加载环境，可使用 Node.js 原生能力与 Electron 渲染进程 API
- 官方文档当前注明 Node.js 版本基线为 `16.x`

#### 结构示例

```javascript
const fs = require('node:fs')

window.services = {
  readFile (filepath) {
    return fs.readFileSync(filepath, { encoding: 'utf-8' })
  }
}
```

#### 第三方模块

- 在 `public/preload/package.json` 声明依赖并安装
- 保持 `node_modules` 原始结构
- 第三方模块源码同样不可混淆或编译

### 样式规范

- 组件样式使用 `scoped`
- 全局样式放在 `src/main.css`
- 支持暗色模式（使用 `@media (prefers-color-scheme: dark)`）
- CSS 变量定义在 `:root`

## plugin.json 开发约束

### 核心字段

```json
{
  "main": "index.html",
  "logo": "logo.png",
  "preload": "preload/services.js",
  "features": []
}
```

### 字段规则

- `main` 必填，必须是相对 `plugin.json` 的 `.html` 路径。
- `logo` 必填，必须是相对路径。
- `preload` 选填，指向预加载脚本。
- `features` 必填，至少一个 feature。
- `pluginSetting.single` 默认是 `true`，控制插件是否单例运行。
- `pluginSetting.height` 默认是 `544`，也可运行时通过 `utools.setExpendHeight()` 调整。

### feature 规则

- `feature.code` 必须唯一；进入插件应用时，uTools 会把该 code 传给前端。
- `feature.explain` 建议填写，便于识别与后续维护。
- `feature.mainPush` 为 `true` 时，可配合 `utools.onMainPush()` 向主搜索框推送候选项。
- `feature.mainHide` 为 `true` 时，触发功能后不主动显示主搜索框，适合静默执行、粘贴内容、弹独立窗口等场景。

### cmds 规则

- `string` 表示功能指令，适合用户直接搜索打开。
- `object` 表示匹配指令，官方支持的常见类型：
  - `regex`: 匹配特定文本
  - `over`: 匹配任意文本
  - `img`: 匹配图像
  - `files`: 匹配文件或文件夹
  - `window`: 匹配当前活动系统窗口
- 功能指令名称应简短、明确、唯一。
- 中文功能指令无需额外配置拼音，uTools 会自动支持拼音和首字母搜索。
- `regex` 不要写“任意匹配”正则，官方文档说明这类表达式会被忽略。
- `files` 匹配可配置 `fileType`、`extensions`、`match`、`minLength`、`maxLength`。
- `window` 匹配可配置应用名 `app`，还可选 `title`、`class`。

### 当前项目的 plugin.json 约定

- 保持 `public/plugin.json` 为单一事实来源。
- 开发阶段保留 `development.main` 指向 Vite 地址。
- 新增功能时，同时更新 `features` 与 `src/App.vue` 的 `action.code -> 组件` 路由。
- 若某功能只用于后台处理、粘贴到外部窗口或直接落盘，可优先考虑 `mainHide: true`。

## uTools API 参考摘要

### 1. 生命周期与入口

优先使用以下 API 驱动页面逻辑：

- `utools.onPluginEnter((action) => {})`
  - 插件被打开时触发。
  - `action.code` 用于区分 feature。
  - `action.type` 常见值：`text`、`img`、`file`、`regex`、`over`、`window`。
  - `action.payload` 是传入内容，可能是文本、文件数组或窗口信息。
- `utools.onPluginOut((isKill) => {})`
  - 插件退出或被隐藏时触发。
  - `isKill === true` 表示结束运行；否则通常只是隐藏到后台。
- `utools.onMainPush(callback, onSelect)`
  - 仅在 feature 配置了 `mainPush: true` 时使用。
  - 适合给主搜索框实时推送候选项。

### 2. 窗口与交互

后续做插件 UI 交互时，这一组 API 很常用：

- `utools.setExpendHeight(height)`: 动态调整插件高度
- `utools.setSubInput(onChange, placeholder?, isFocus?)`: 把主输入框作为子输入框使用
- `utools.removeSubInput()`: 移除子输入框
- `utools.setSubInputValue(text)`: 设置子输入框值
- `utools.subInputFocus()` / `utools.subInputBlur()` / `utools.subInputSelect()`
- `utools.hideMainWindow(isRestorePreWindow?)`: 隐藏主窗口
- `utools.showMainWindow()`: 显示主窗口
- `utools.outPlugin(isKill?)`: 退出插件
- `utools.redirect(label, payload?)`: 跳转到其他插件或指令
- `utools.showOpenDialog(options)`: 打开文件选择框
- `utools.showSaveDialog(options)`: 打开保存对话框
- `utools.startDrag(filePath)`: 从插件窗口拖出文件
- `utools.createBrowserWindow(url, options, callback?)`: 创建独立窗口

开发建议：

- 涉及搜索、筛选、命令面板类界面时，优先考虑 `setSubInput()`。
- 组件销毁或插件退出时，记得清理 `subInput` 状态。
- 需要长流程编辑器或多窗口体验时，再考虑 `createBrowserWindow()`。

### 3. 复制、粘贴、外部窗口输入

适合做“把内容写回外部应用”的功能：

- `utools.copyText(text)`
- `utools.copyFile(filePath)`
- `utools.hideMainWindowPasteText(text)`
- `utools.hideMainWindowPasteImage(image)`
- `utools.hideMainWindowPasteFile(filePath)`

开发建议：

- 若功能目标是“处理完立即回填到用户当前窗口”，优先使用 `hideMainWindowPaste*`。
- 对这类功能，`feature.mainHide` 通常比默认打开主界面更合适。

### 4. 系统能力

常用系统 API：

- `utools.showNotification(body, clickFeatureCode?)`
- `utools.shellOpenPath(fullPath)`
- `utools.shellOpenExternal(url)`
- `utools.shellTrashItem(fullPath)`
- `utools.shellBeep()`
- `utools.getPath(name)`
  - 常用值：`home`、`appData`、`userData`、`temp`、`desktop`、`documents`、`downloads`
- `utools.getFileIcon(filePath)`
- `utools.readCurrentBrowserUrl()`
- `utools.isDev()`
- `utools.isMacOS()` / `utools.isWindows()` / `utools.isLinux()`
- `utools.getNativeId()`

开发建议：

- 需要默认存储目录时，优先用 `utools.getPath('downloads')`、`getPath('userData')`，不要硬编码平台路径。
- 与系统行为相关的代码必须做跨平台判断，不要默认只支持 macOS 或 Windows。
- 错误提示统一优先用 `showNotification()`。

### 5. 数据存储

官方提供三层常用存储能力：

- `utools.db.*`
  - 文档型数据库，支持同步版与 `promises` 异步版。
  - 常用：`put`、`get`、`allDocs`、`remove`、`bulkDocs`。
  - 更新文档时必须带 `_rev`，否则会失败。
  - 单文档内容不超过 `1M`。
  - 附件可用 `postAttachment`，单附件不超过 `10M`。
  - 官方明确提醒：多设备同时编辑同一文档可能冲突，应尽量拆分文档，避免所有数据都塞进一个 doc。
- `utools.dbStorage.*`
  - 类似 `localStorage` 的键值对接口，适合轻量配置、开关、最近使用项。
- `utools.dbCryptoStorage.*`
  - 加密版键值存储，适合 token、敏感配置、私密偏好。

本项目建议：

- 简单 UI 状态、过滤器、用户偏好优先用 `dbStorage`。
- 结构化 skill 数据、可同步的管理数据优先用 `db`。
- 敏感配置优先用 `dbCryptoStorage`。

### 6. 动态指令

当插件功能不是在 `plugin.json` 写死，而是由用户配置动态生成时，使用：

- `utools.getFeatures(codes?)`
- `utools.setFeature(feature)`
- `utools.removeFeature(code)`
- `utools.redirectHotKeySetting(cmdLabel, autocopy?)`
- `utools.redirectAiModelsSetting()`

适用场景：

- 用户自定义快捷入口
- 按配置生成多个子功能
- 将某个指令引导到全局快捷键设置

### 7. AI / Tool 集成

官方最新 `plugin.json` 文档已支持 `tools` 配置，可把插件能力暴露给 AI Agent。

开发约束：

- 若配置了 `tools`，运行时代码必须配合 `utools.registerTool(...)` 注册，否则 AI Agent 不能实际调用。
- tool 名建议使用小写 `snake_case`。
- 输入输出结构应使用清晰、严格的 JSON Schema。

## 类型定义

- 使用 `utools-api-types` 获取类型提示。
- 所有 uTools API 通过 `window.utools.*` 调用。
- 所有本地 Node 服务通过 `window.services.*` 调用。
- 新增 preload 能力时，建议同步补充 `window.services` 的 TypeScript 声明，避免前端失去类型提示。

## 文件目录结构

```text
/public
  ├── plugin.json         # 插件配置
  ├── preload/            # Node.js 预加载脚本（不参与 Vite 构建）
  │   ├── package.json    # CommonJS 依赖
  │   └── services.js
/src
  ├── main.js             # 应用入口
  ├── App.vue             # 根组件，按 enterAction.code 分发功能
  ├── main.css            # 全局样式
  └── [FeatureName]/      # 功能组件
      └── index.vue
/dist                     # 构建输出（用于打包）
```

## 开发时的默认判断规则

- 如果需求能通过 `window.utools` 直接完成，优先不用 preload。
- 如果需求需要 Node.js、文件系统、路径处理或第三方 Node 模块，放到 preload。
- 如果只是简单设置持久化，优先 `dbStorage`；如果要同步/结构化文档，优先 `db`。
- 如果 feature 触发后不需要用户停留在插件窗口，优先考虑 `mainHide + hideMainWindowPaste*`。
- 如果新增功能入口，必须同时检查：
  - `public/plugin.json` 的 `features`
  - `src/App.vue` 的路由分发
  - 对应功能组件目录与命名
