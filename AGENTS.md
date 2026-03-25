# Skills Manager - uTools 插件项目

## 项目简介

Skills Manager 是一个用于管理本地已安装 skills 的 uTools 插件，提供可视化 UI 界面来管理 skill。

## 开发命令

```bash
# 开发环境启动
npm run dev

# 生产构建（输出到 dist/ 目录）
npm run build
```

注意：打包为 uTools 插件时，仅打包 dist/ 文件夹，不要打包整个项目根目录。

## 代码规范

### 前端代码

#### 技术栈
- Vue 3 Composition API (`<script setup>`)
- TypeScript（使用 `<script lang="ts" setup>`）
- Vite 构建工具
- uTools API (types: `utools-api-types`)

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
<style scoped>/* styles */</style>
```

#### 命名规范
- 组件文件/目录：`PascalCase` (如 `Hello/index.vue`, `App.vue`)
- 变量/函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 类名：`PascalCase`

#### 导入顺序
1. Vue imports (`ref`, `watch`, `reactive`, etc.)
2. 第三方库
3. 组件导入
4. 类型导入
5. 工具函数

#### API 调用
- uTools API: `window.utools.*`
- Node.js 服务: `window.services.*` (通过 preload 注入)

#### 错误处理
try-catch 包装可能失败操作，失败时使用 `window.utools.showNotification()` 提示。

### Preload 代码

#### 规范要求
- 使用 CommonJS 规范 (`require`)
- 必须清晰可读，不可打包/压缩/混淆
- 位于 `public/preload/` 目录，不参与 Vite 构建

#### 结构示例
```javascript
const fs = require('node:fs')
window.services = {
  readFile (filepath) { return fs.readFileSync(filepath, { encoding: 'utf-8' }) }
}
```

#### 第三方模块
在 `public/preload/package.json` 声明依赖，使用 npm 安装，保持 node_modules 原始结构。**不可混淆或编译。**

### 样式规范

- 组件样式使用 scoped
- 全局样式放在 `src/main.css`
- 支持暗色模式（使用 `@media (prefers-color-scheme: dark)`）
- CSS 变量定义在 `:root`

## uTools 插件配置

### plugin.json 核心字段
```json
{ "main": "index.html", "logo": "logo.png", "preload": "preload/services.js", "features": [...] }
```
字符串=功能指令，对象=匹配指令（regex/over/img/files/window）。

## 类型定义
使用 `utools-api-types` 获取类型提示，通过 `window.utools.*` 和 `window.services.*` 调用 API。

## 文件目录结构

```
/public
  ├── plugin.json         # 插件配置
  ├── preload/            # Node.js 预加载脚本（不打包）
  │   ├── package.json    # CommonJS 依赖
  │   └── services.js
/src
  ├── main.js             # 应用入口
  ├── App.vue             # 根组件
  ├── main.css            # 全局样式
  └── [FeatureName]/      # 功能组件
      └── index.vue
dist/                     # 构建输出（用于打包）
```

## 相关文档

- uTools 开发者文档: https://www.u-tools.cn/docs/developer/basic/getting-started.html
- plugin.json 配置: https://www.u-tools.cn/docs/developer/information/plugin-json.html
- preload 预加载脚本: https://www.u-tools.cn/docs/developer/information/preload.html
- API 参考: https://www.u-tools.cn/docs/developer/docs.html
