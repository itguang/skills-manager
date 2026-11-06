<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Crepe } from '@milkdown/crepe'
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core'
import { remarkGFMPlugin } from '@milkdown/kit/preset/gfm'
// 按需引入主题样式：不引 latex.css / ai.css，避免把用不到的 KaTeX 字体打进插件
import '@milkdown/crepe/theme/common/prosemirror.css'
import '@milkdown/crepe/theme/common/reset.css'
import '@milkdown/crepe/theme/common/block-edit.css'
import '@milkdown/crepe/theme/common/code-mirror.css'
import '@milkdown/crepe/theme/common/cursor.css'
import '@milkdown/crepe/theme/common/image-block.css'
import '@milkdown/crepe/theme/common/link-tooltip.css'
import '@milkdown/crepe/theme/common/list-item.css'
import '@milkdown/crepe/theme/common/placeholder.css'
import '@milkdown/crepe/theme/common/toolbar.css'
import '@milkdown/crepe/theme/common/table.css'

const props = defineProps<{
  // 只在挂载和切换文件时读取，编辑过程中由编辑器自己维护内容
  initialValue: string
  documentKey: string
}>()

const emit = defineEmits<{
  change: [markdown: string]
}>()

const hostElement = ref<HTMLElement | null>(null)
let crepe: Crepe | null = null
// 切换文件时上一次 create 可能还没完成，用递增序号丢弃过期的实例
let createGeneration = 0

const SLASH_MENU_LABELS = {
  textGroup: {
    label: '文本',
    text: { label: '正文' },
    h1: { label: '一级标题' },
    h2: { label: '二级标题' },
    h3: { label: '三级标题' },
    h4: { label: '四级标题' },
    h5: { label: '五级标题' },
    h6: { label: '六级标题' },
    quote: { label: '引用' },
    divider: { label: '分割线' }
  },
  listGroup: {
    label: '列表',
    bulletList: { label: '无序列表' },
    orderedList: { label: '有序列表' },
    taskList: { label: '任务列表' }
  },
  advancedGroup: {
    label: '高级',
    image: { label: '图片' },
    codeBlock: { label: '代码块' },
    table: { label: '表格' },
    math: { label: '公式' }
  }
}

async function createEditor (markdown: string) {
  const generation = ++createGeneration
  await destroyEditor()
  if (!hostElement.value || generation !== createGeneration) return

  const instance = new Crepe({
    root: hostElement.value,
    defaultValue: markdown,
    features: {
      [Crepe.Feature.Latex]: false,
      [Crepe.Feature.AI]: false,
      [Crepe.Feature.TopBar]: false
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: '输入 / 插入标题、列表、代码块…', mode: 'doc' },
      [Crepe.Feature.BlockEdit]: SLASH_MENU_LABELS as any,
      [Crepe.Feature.Toolbar]: {
        boldLabel: '加粗',
        italicLabel: '斜体',
        strikethroughLabel: '删除线',
        codeLabel: '行内代码',
        linkLabel: '链接'
      }
    }
  })

  // 输出风格尽量贴近手写 Markdown，避免只是打开保存一次就把整篇列表、表格全部改写
  instance.editor
    .config((context) => {
      context.update(remarkStringifyOptionsCtx, (options) => ({ ...options, bullet: '-' as const, rule: '-' as const }))
      context.set(remarkGFMPlugin.options.key, { tablePipeAlign: false })
    })

  instance.on((listener) => {
    listener.markdownUpdated((_context, nextMarkdown, previousMarkdown) => {
      if (nextMarkdown !== previousMarkdown) emit('change', nextMarkdown)
    })
  })

  await instance.create()

  if (generation !== createGeneration) {
    await instance.destroy()
    return
  }
  crepe = instance
}

async function destroyEditor () {
  const instance = crepe
  crepe = null
  if (instance) await instance.destroy()
}

watch(() => props.documentKey, () => {
  createEditor(props.initialValue)
})

onMounted(() => {
  createEditor(props.initialValue)
})

onBeforeUnmount(() => {
  createGeneration += 1
  destroyEditor()
})
</script>

<template>
  <div ref="hostElement" class="markdown-wysiwyg" />
</template>

<style scoped>
.markdown-wysiwyg {
  height: 100%;
  overflow: auto;
}

/* 让 Crepe 使用插件自己的设计 token，而不是它默认的暖色主题 */
.markdown-wysiwyg :deep(.milkdown) {
  --crepe-color-background: var(--surface);
  --crepe-color-on-background: var(--text);
  --crepe-color-surface: var(--surface);
  --crepe-color-surface-low: var(--surface-muted);
  --crepe-color-on-surface: var(--text);
  --crepe-color-on-surface-variant: var(--text-soft);
  --crepe-color-outline: var(--border-strong);
  --crepe-color-primary: var(--brand);
  --crepe-color-secondary: var(--brand-soft);
  --crepe-color-on-secondary: var(--text);
  --crepe-color-inverse: var(--text);
  --crepe-color-on-inverse: var(--surface);
  --crepe-color-inline-code: var(--danger);
  --crepe-color-error: var(--danger);
  --crepe-color-hover: var(--surface-hover);
  --crepe-color-selected: var(--brand-soft);
  --crepe-color-inline-area: var(--surface-muted);
  --crepe-base-font-size: 14px;
  --crepe-font-title: inherit;
  --crepe-font-default: inherit;
  --crepe-font-code: var(--font-mono);
  --crepe-shadow-1: 0 1px 3px rgba(0, 0, 0, 0.12);
  --crepe-shadow-2: 0 4px 14px rgba(0, 0, 0, 0.14);
}

.markdown-wysiwyg :deep(.milkdown .ProseMirror) {
  padding: 16px 48px 48px 64px;
}

.markdown-wysiwyg :deep(.milkdown .milkdown-code-block) {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-muted);
}

.markdown-wysiwyg :deep(.milkdown .milkdown-code-block .cm-editor),
.markdown-wysiwyg :deep(.milkdown .milkdown-code-block .cm-gutters),
.markdown-wysiwyg :deep(.milkdown .milkdown-code-block .cm-activeLine),
.markdown-wysiwyg :deep(.milkdown .milkdown-code-block .cm-activeLineGutter) {
  background: transparent;
}

.markdown-wysiwyg :deep(.milkdown .milkdown-code-block .cm-content) {
  color: var(--text);
}

.markdown-wysiwyg :deep(.milkdown .milkdown-code-block .cm-gutters) {
  border-right: 1px solid var(--border);
  color: var(--text-faint);
}

.markdown-wysiwyg :deep(.milkdown h1) {
  font-size: 22px;
}

.markdown-wysiwyg :deep(.milkdown h2) {
  font-size: 18px;
}

.markdown-wysiwyg :deep(.milkdown h3) {
  font-size: 16px;
}
</style>
