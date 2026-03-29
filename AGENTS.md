# Skills Manager - uTools 插件项目

## 项目简介

Skills Manager 是一个用于管理本地已安装 skills 的 uTools 插件，提供可视化 UI 来扫描目录、查看技能信息、启用/禁用技能与删除技能目录。

## 当前技术栈（已按仓库现状更新）

以下信息基于当前代码仓库，更新时间：`2026-03-29`。

### 前端与构建

- Vue `^3.5.13`
- Element Plus `^2.13.6`
- Vite `^6.0.11`
- `@vitejs/plugin-vue` `^5.2.1`
- 包管理及脚本：
  - `npm run dev` -> `vite`
  - `npm run build` -> `vite build`

### 运行与模块体系

- 根 `package.json` 为 `"type": "module"`，前端代码使用 ESM。
- `src/main.js` 通过 `app.use(ElementPlus)` 全量注册 Element Plus。
- `public/preload/package.json` 为 `"type": "commonjs"`，preload 使用 CommonJS（`require`）。

### 类型与开发体验

- 项目在 Vue SFC 中使用 `<script lang="ts" setup>`。
- 使用 `utools-api-types` 提供 API 类型提示。
- 当前仓库未启用独立 `tsc` 构建流程（以 Vite + IDE 类型提示为主）。
- `unplugin-auto-import` 与 `unplugin-vue-components` 已安装，但当前 `vite.config.js` 未启用这两个插件，导入仍以手动显式导入为准。

## uTools 运行模型

- 插件本质是 `Node.js 本地能力 + Web 前端页面`。
- 渲染层仅通过 `window.utools.*` 调官方 API。
- 本地文件系统/路径/Node 能力通过 preload 封装后暴露给 `window.services.*`。
- 当前项目主入口在 `src/App.vue`：
  - 监听 `window.utools.onPluginEnter`
  - 将 `action` 透传给 `SkillManager` 组件
  - 当前仅使用 `skills-manager` 这一 feature

## 开发命令

```bash
# 本地开发
npm run dev

# 生产构建（输出 dist/）
npm run build
```

注意：

- uTools 打包时仅打包 `dist/`。
- `public/plugin.json` 中 `development.main` 当前指向 `http://localhost:5173`。
- preload 改动通常不能像前端那样热更新，开发时建议开启“退出到后台立即结束运行”。

## 当前目录结构（关键）

```text
/public
  /plugin.json
  /preload
    /package.json
    /services.js
/src
  /main.js
  /main.css
  /App.vue
  /SkillManager/index.vue   # 当前主要功能页面
  /Hello/index.vue          # 旧示例组件（当前入口未使用）
  /Read/index.vue           # 旧示例组件（当前入口未使用）
  /Write/index.vue          # 旧示例组件（当前入口未使用）
/dist
```

## 前端开发规范

### 组件与脚本风格

- Vue 组件优先使用 Composition API + `<script lang="ts" setup>`。
- 变量/函数使用 `camelCase`，常量使用 `UPPER_SNAKE_CASE`。
- 组件文件/目录使用 `PascalCase`。

### 导入顺序

1. Vue imports（`ref`、`computed`、`watch` 等）
2. 第三方库
3. 组件导入
4. 类型导入
5. 工具函数

### API 边界

- 允许：`window.utools.*`
- 允许：`window.services.*`
- 禁止在 Vue 组件中直接使用 `require('node:*')` 或直接依赖 Electron。
- 文件系统、路径、进程、原生调用优先放到 preload 封装。

### 错误处理

- 可能失败的操作必须 `try-catch`。
- 失败优先 `window.utools.showNotification()` 给出明确提示。
- 对写入类逻辑需处理空值、权限、路径不存在、目标已存在等情况。

### UI 与排版约束（保持现有交互风格）

- 默认优先紧凑布局：同一信息密度能一行展示就不拆行。
- 优先通过截断、限宽、间距压缩解决空间问题，而不是增加纵向层级。
- 技能列表卡片中：名称、版本、作者、标签、右侧操作区优先保持同一行。
- 操作按钮容器默认靠右对齐（含小屏）。

### Element Plus 使用约束

- 组件库以 Element Plus 为主，避免重复造基础组件。
- 样式主题变量统一在 `src/main.css` 的 `:root` 维护（含暗色模式变量）。
- 功能按钮、状态、Tag 等优先使用 Element Plus 原生组件和语义类型。

## Preload 规范

- preload 文件位于 `public/preload/`，不参与 Vite 构建。
- 使用 CommonJS，代码必须可读，不压缩、不混淆。
- 暴露能力统一挂到 `window.services`。
- 当前 `window.services` 提供：
  - `scanSkills({ directories, projectRoot })`
  - `setSkillDisabled({ skillDirPath, disabled })`
  - `removeSkill({ skillDirPath })`

## plugin.json 当前约定

`public/plugin.json` 是插件配置单一事实来源，当前关键字段：

```json
{
  "main": "index.html",
  "preload": "preload/services.js",
  "development": { "main": "http://localhost:5173" },
  "pluginSetting": { "height": 816 },
  "features": [
    { "code": "skills-manager", "cmds": ["skills", "skill manager", "skills manager", "管理 skills", "技能管理"] }
  ]
}
```

新增/修改功能时必须同步检查：

- `public/plugin.json` 的 `features`
- `src/App.vue` 的 `action.code -> 组件` 分发逻辑
- 对应功能组件目录与命名

## 数据与状态约定

- 轻量持久化使用 `window.utools.dbStorage`。
- 当前关键存储键：
  - `skills-manager.directories`
  - `skills-manager.projectRoot`
- 技能文件状态约定：
  - 启用：`SKILL.md`
  - 禁用：`SKILL.md.disabled`

## 文档基线（uTools 官方）

以下链接为本项目开发时优先参考：

- 快速开始: https://www.u-tools.cn/docs/developer/basic/getting-started.html
- 第一个插件应用: https://www.u-tools.cn/docs/developer/basic/first-plugin.html
- 调试插件应用: https://www.u-tools.cn/docs/developer/basic/debug-plugin.html
- plugin.json 配置: https://www.u-tools.cn/docs/developer/information/plugin-json.html
- preload 预加载脚本: https://www.u-tools.cn/docs/developer/information/preload.html
- API 总览: https://www.u-tools.cn/docs/developer/docs.html
- 事件 API: https://www.u-tools.cn/docs/developer/utools-api/events.html
- 窗口 API: https://www.u-tools.cn/docs/developer/utools-api/window.html
- 系统 API: https://www.u-tools.cn/docs/developer/utools-api/system.html
- 本地数据库 API: https://www.u-tools.cn/docs/developer/utools-api/db.html
- 动态指令 API: https://www.u-tools.cn/docs/developer/api-reference/utools/features.html
- dbStorage: https://www.u-tools.cn/docs/developer/api-reference/db/db-storage.html
- dbCryptoStorage: https://www.u-tools.cn/docs/developer/api-reference/db/db-crypto-storage.html

## 开发默认判断规则

- 能用 `window.utools` 直接实现的能力，优先不新增 preload 接口。
- 需要 Node.js/文件系统/路径处理的能力，放到 preload。
- 仅轻量配置或页面偏好，优先 `dbStorage`。
- 触发后无需停留在插件窗口的能力，优先考虑 `mainHide + hideMainWindowPaste*` 方案。
