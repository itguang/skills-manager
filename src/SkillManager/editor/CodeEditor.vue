<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { yaml, yamlFrontmatter } from '@codemirror/lang-yaml'

const props = defineProps<{
  initialValue: string
  documentKey: string
  fileName: string
}>()

const emit = defineEmits<{
  change: [content: string]
}>()

const hostElement = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

function getLanguageExtension (fileName: string): Extension[] {
  const extension = fileName.toLowerCase().split('.').pop() || ''

  // SKILL.md 顶部的 YAML frontmatter 要单独识别，否则会被当成 Markdown 的 setext 标题渲染
  if (['md', 'markdown', 'disabled'].includes(extension)) return [yamlFrontmatter({ content: markdown() })]
  if (['js', 'mjs', 'cjs'].includes(extension)) return [javascript()]
  if (['ts', 'mts', 'cts'].includes(extension)) return [javascript({ typescript: true })]
  if (extension === 'json') return [json()]
  if (extension === 'py') return [python()]
  if (['yaml', 'yml'].includes(extension)) return [yaml()]
  return []
}

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--brand)' },
  '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--text-faint)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--surface-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-hover)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--brand)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--brand-soft) !important' }
})

// 颜色取自全局设计 token，亮色和暗色模式自动跟随
const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: 'var(--agent-copilot)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--agent-agents)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--agent-opencode)' },
  { tag: [tags.comment, tags.meta], color: 'var(--text-faint)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--agent-cursor)' },
  { tag: [tags.definition(tags.variableName), tags.className, tags.typeName], color: 'var(--agent-gemini)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--agent-claude)' },
  { tag: tags.heading, color: 'var(--text)', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--agent-cursor)' },
  { tag: [tags.monospace, tags.processingInstruction], color: 'var(--agent-claude)' },
  { tag: [tags.contentSeparator, tags.punctuation], color: 'var(--text-faint)' }
])

function createState (content: string) {
  return EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      EditorView.lineWrapping,
      editorTheme,
      syntaxHighlighting(highlightStyle),
      ...getLanguageExtension(props.fileName),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('change', update.state.doc.toString())
      })
    ]
  })
}

watch(() => props.documentKey, () => {
  editorView?.setState(createState(props.initialValue))
})

onMounted(() => {
  if (!hostElement.value) return
  editorView = new EditorView({ state: createState(props.initialValue), parent: hostElement.value })
})

onBeforeUnmount(() => {
  editorView?.destroy()
  editorView = null
})
</script>

<template>
  <div ref="hostElement" class="code-editor" />
</template>

<style scoped>
.code-editor {
  height: 100%;
  overflow: hidden;
}
</style>
