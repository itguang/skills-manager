<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, DocumentAdd, FolderOpened, Tickets } from '@element-plus/icons-vue'
import CodeEditor from './CodeEditor.vue'
import FileTree from './FileTree.vue'
import FrontmatterForm from './FrontmatterForm.vue'
import MarkdownWysiwyg from './MarkdownWysiwyg.vue'
import type { FileTreeNode } from './FileTree.vue'
import type { FrontmatterFields } from './frontmatter'
import { applyFrontmatterFields, joinMarkdown, parseFrontmatter, splitMarkdown } from './frontmatter'
import type { Skill } from '../types'
import { getErrorMessage, openPath, showNotification } from '../utils'

const props = defineProps<{
  skill: Skill
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

type EditMode = 'wysiwyg' | 'source'

interface OpenFile {
  relativePath: string
  savedContent: string
  content: string
  mtimeMs: number
  editable: boolean
  reason: string
  // 每次重新加载文件内容时递增，用来通知编辑器整体替换文档
  revision: number
}

const EDIT_MODE_OPTIONS = [
  { value: 'wysiwyg', label: '所见即所得' },
  { value: 'source', label: '源码' }
]

const fileTree = ref<FileTreeNode[]>([])
const treeTruncated = ref(false)
const openFiles = ref(new Map<string, OpenFile>())
const activePath = ref('')
const editMode = ref<EditMode>('wysiwyg')
const isSaving = ref(false)
const showFrontmatterForm = ref(true)
// 编辑 Markdown 正文时只把正文交给所见即所得编辑器，frontmatter 由表单单独维护
const wysiwygBody = shallowRef('')

// 用扫描目录里看到的路径（软链接保持链接路径）作为根目录，读写会自动落到链接目标上
const skillRoot = computed(() => props.skill.path)
const mainFilePath = computed(() => props.skill.skillFilePath.split(/[\\/]/).pop() || 'SKILL.md')
const activeFile = computed(() => openFiles.value.get(activePath.value) || null)
const isMarkdownFile = computed(() => /\.(md|markdown)$|SKILL\.md\.disabled$/i.test(activePath.value))
const isMainFile = computed(() => activePath.value === mainFilePath.value)
const dirtyPaths = computed(() => new Set(
  Array.from(openFiles.value.values())
    .filter((file) => file.content !== file.savedContent)
    .map((file) => file.relativePath)
))
const isActiveDirty = computed(() => dirtyPaths.value.has(activePath.value))

const splitContent = computed(() => splitMarkdown(activeFile.value?.content || ''))
const parsedFrontmatter = computed(() => parseFrontmatter(splitContent.value.frontmatter))
const liveSpecIssues = computed(() => {
  if (!isMainFile.value || !activeFile.value) return []
  try {
    return window.services.validateSkillContent({ content: activeFile.value.content, directoryName: props.skill.directoryName })
  } catch (error) {
    return []
  }
})

const frontmatterFields = computed<FrontmatterFields>({
  get: () => parsedFrontmatter.value.fields,
  set: (fields) => {
    const file = activeFile.value
    if (!file) return
    try {
      const nextFrontmatter = applyFrontmatterFields(splitContent.value.frontmatter, fields)
      updateActiveContent(joinMarkdown(nextFrontmatter, splitContent.value.body))
    } catch (error) {
      showNotification(getErrorMessage(error, '更新 frontmatter 失败'))
    }
  }
})

// 带 frontmatter 的 Markdown 在所见即所得模式下需要显示表单，源码模式里直接编辑原文
const showsFormInWysiwyg = computed(() => isMarkdownFile.value && (isMainFile.value || splitContent.value.hasFrontmatter))

function loadFileTree () {
  try {
    const result = window.services.listSkillFiles({ skillRoot: skillRoot.value })
    fileTree.value = result.nodes
    treeTruncated.value = result.truncated
  } catch (error) {
    showNotification(getErrorMessage(error, '读取 skill 文件列表失败'))
  }
}

function loadFile (relativePath: string) {
  try {
    const result = window.services.readEditableFile({ skillRoot: skillRoot.value, relativePath })
    const previous = openFiles.value.get(relativePath)
    const nextFiles = new Map(openFiles.value)
    nextFiles.set(relativePath, {
      relativePath,
      savedContent: result.content,
      content: result.content,
      mtimeMs: result.mtimeMs,
      editable: result.editable,
      reason: result.reason,
      revision: (previous?.revision || 0) + 1
    })
    openFiles.value = nextFiles
    return true
  } catch (error) {
    showNotification(getErrorMessage(error, '读取文件失败'))
    return false
  }
}

function syncWysiwygBody () {
  wysiwygBody.value = splitContent.value.body
}

function selectFile (relativePath: string) {
  if (!openFiles.value.has(relativePath) && !loadFile(relativePath)) return
  activePath.value = relativePath
  syncWysiwygBody()
}

function updateActiveContent (content: string) {
  const file = activeFile.value
  if (!file || file.content === content) return
  const nextFiles = new Map(openFiles.value)
  nextFiles.set(file.relativePath, { ...file, content })
  openFiles.value = nextFiles
}

function handleWysiwygChange (body: string) {
  if (!showsFormInWysiwyg.value) {
    updateActiveContent(body)
    return
  }
  updateActiveContent(joinMarkdown(splitContent.value.frontmatter, body))
}

// 切换模式前把当前内容同步给目标编辑器，保证两边看到的是同一份文本
function changeEditMode (mode: EditMode) {
  if (mode === 'wysiwyg') syncWysiwygBody()
  editMode.value = mode
}

async function confirmOverwrite () {
  try {
    await ElMessageBox.confirm(
      '文件在打开后被其它程序修改过。覆盖会丢失那些修改；重新加载会丢失你在这里的修改。',
      '文件冲突',
      {
        type: 'warning',
        confirmButtonText: '覆盖保存',
        cancelButtonText: '重新加载',
        distinguishCancelAndClose: true
      }
    )
    return 'overwrite'
  } catch (action) {
    return action === 'cancel' ? 'reload' : 'abort'
  }
}

async function saveFile (relativePath: string, force = false): Promise<boolean> {
  const file = openFiles.value.get(relativePath)
  if (!file || file.content === file.savedContent) return true

  try {
    const result = window.services.writeEditableFile({
      skillRoot: skillRoot.value,
      relativePath,
      content: file.content,
      expectedMtimeMs: file.mtimeMs,
      force
    })
    const nextFiles = new Map(openFiles.value)
    nextFiles.set(relativePath, { ...file, savedContent: file.content, mtimeMs: result.mtimeMs })
    openFiles.value = nextFiles
    return true
  } catch (error: any) {
    if (error?.code !== 'FILE_CONFLICT') {
      showNotification(getErrorMessage(error, '保存失败'))
      return false
    }

    const decision = await confirmOverwrite()
    if (decision === 'overwrite') return saveFile(relativePath, true)
    if (decision === 'reload') {
      loadFile(relativePath)
      if (relativePath === activePath.value) syncWysiwygBody()
    }
    return false
  }
}

async function saveActiveFile () {
  if (isSaving.value || !activeFile.value?.editable) return
  isSaving.value = true
  try {
    const saved = await saveFile(activePath.value)
    if (saved) {
      ElMessage.success('已保存')
      emit('saved')
    }
  } finally {
    isSaving.value = false
  }
}

async function saveAllFiles () {
  for (const relativePath of dirtyPaths.value) {
    if (!(await saveFile(relativePath))) return false
  }
  return true
}

async function requestClose () {
  if (dirtyPaths.value.size === 0) {
    emit('close')
    return
  }

  try {
    await ElMessageBox.confirm(`有 ${dirtyPaths.value.size} 个文件尚未保存。`, '离开编辑器', {
      type: 'warning',
      confirmButtonText: '保存并离开',
      cancelButtonText: '放弃修改',
      distinguishCancelAndClose: true
    })
    if (await saveAllFiles()) {
      emit('saved')
      emit('close')
    }
  } catch (action) {
    if (action === 'cancel') emit('close')
  }
}

async function createFile () {
  let relativePath = ''
  try {
    const result = await ElMessageBox.prompt('相对 skill 目录的路径，例如 references/guide.md', '新建文件', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: 'references/guide.md',
      inputValidator: (value: string) => Boolean(value && value.trim() && !value.trim().endsWith('/')) || '请输入文件路径'
    })
    relativePath = result.value.trim()
  } catch (cancelled) {
    return
  }

  try {
    const created = window.services.createSkillFile({ skillRoot: skillRoot.value, relativePath })
    loadFileTree()
    selectFile(created.relativePath)
  } catch (error) {
    showNotification(getErrorMessage(error, '新建文件失败'))
  }
}

function openActiveFileExternally () {
  try {
    openPath(window.services.resolveSkillFilePath({ skillRoot: skillRoot.value, relativePath: activePath.value }))
  } catch (error) {
    showNotification(getErrorMessage(error, '打开文件失败'))
  }
}

function handleKeydown (event: KeyboardEvent) {
  const isSaveShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's'
  if (!isSaveShortcut) return
  event.preventDefault()
  saveActiveFile()
}

// 源码模式切换文件或重新加载时，用 revision 让 CodeMirror 替换整个文档
const editorDocumentKey = computed(() => `${activePath.value}#${activeFile.value?.revision || 0}`)

onMounted(() => {
  loadFileTree()
  selectFile(mainFilePath.value)
  window.addEventListener('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, true)
})

defineExpose({ requestClose })
</script>

<template>
  <div class="skill-editor">
    <header class="editor-header">
      <button class="icon-button" type="button" title="返回" aria-label="返回" @click="requestClose">
        <el-icon><Back /></el-icon>
      </button>
      <div class="editor-title">
        <span class="editor-skill-name">{{ skill.name }}</span>
        <span class="editor-file-path">/ {{ activePath }}</span>
        <span v-if="isActiveDirty" class="editor-dirty">未保存</span>
      </div>

      <el-segmented
        v-if="isMarkdownFile && activeFile?.editable"
        :model-value="editMode"
        :options="EDIT_MODE_OPTIONS"
        size="small"
        @update:model-value="(mode: EditMode) => changeEditMode(mode)"
      />
      <button
        v-if="showsFormInWysiwyg && editMode === 'wysiwyg'"
        :class="['icon-button', { 'is-on': showFrontmatterForm }]"
        type="button"
        title="显示 / 隐藏 frontmatter 表单"
        @click="showFrontmatterForm = !showFrontmatterForm"
      >
        <el-icon><Tickets /></el-icon>
      </button>
      <button class="icon-button" type="button" title="用默认编辑器打开" @click="openActiveFileExternally">
        <el-icon><FolderOpened /></el-icon>
      </button>
      <el-button
        :disabled="!isActiveDirty || !activeFile?.editable"
        :loading="isSaving"
        size="small"
        type="primary"
        @click="saveActiveFile"
      >
        保存 <span class="shortcut-hint">⌘S</span>
      </el-button>
    </header>

    <div class="editor-body">
      <aside class="editor-sidebar">
        <div class="sidebar-header">
          <span>文件</span>
          <button class="icon-button" type="button" title="新建文件" @click="createFile">
            <el-icon><DocumentAdd /></el-icon>
          </button>
        </div>
        <el-scrollbar class="sidebar-scroll">
          <FileTree :active-path="activePath" :dirty-paths="dirtyPaths" :nodes="fileTree" @select="selectFile" />
          <p v-if="treeTruncated" class="sidebar-note">文件过多，仅显示前 500 项</p>
        </el-scrollbar>
      </aside>

      <main class="editor-main">
        <div v-if="activeFile && !activeFile.editable" class="editor-placeholder">
          <p>{{ activeFile.reason }}</p>
          <el-button size="small" @click="openActiveFileExternally">用默认程序打开</el-button>
        </div>

        <template v-else-if="activeFile">
          <template v-if="isMarkdownFile && editMode === 'wysiwyg'">
            <div class="wysiwyg-layout">
              <FrontmatterForm
                v-if="showsFormInWysiwyg && showFrontmatterForm"
                v-model="frontmatterFields"
                :directory-name="skill.directoryName"
                :parse-error="parsedFrontmatter.error"
                :spec-issues="isMainFile ? liveSpecIssues : []"
              />
              <MarkdownWysiwyg
                class="wysiwyg-editor"
                :document-key="editorDocumentKey"
                :initial-value="showsFormInWysiwyg ? wysiwygBody : activeFile.content"
                @change="handleWysiwygChange"
              />
            </div>
          </template>

          <CodeEditor
            v-else
            :document-key="editorDocumentKey"
            :file-name="activePath"
            :initial-value="activeFile.content"
            @change="updateActiveContent"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.skill-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--surface);
}

.editor-header {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.editor-title {
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
  align-items: baseline;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.editor-skill-name {
  font-size: 14px;
  font-weight: 600;
}

.editor-file-path {
  min-width: 0;
  overflow: hidden;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 12px;
  text-overflow: ellipsis;
}

.editor-dirty {
  flex: 0 0 auto;
  color: var(--warning);
  font-size: 12px;
}

.icon-button.is-on {
  background: var(--brand-soft);
  color: var(--brand);
}

.shortcut-hint {
  margin-left: 4px;
  opacity: 0.7;
  font-size: 11px;
}

.editor-body {
  display: grid;
  flex: 1;
  grid-template-columns: 180px minmax(0, 1fr);
  min-height: 0;
}

.editor-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border);
  background: var(--bg);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 6px 4px 12px;
  color: var(--text-faint);
  font-size: 12px;
}

.sidebar-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 4px 8px;
}

.sidebar-note {
  margin: 8px;
  color: var(--text-faint);
  font-size: 11px;
}

.editor-main {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.wysiwyg-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.wysiwyg-editor {
  flex: 1;
  min-height: 0;
}

.editor-placeholder {
  display: grid;
  gap: 8px;
  place-content: center;
  justify-items: center;
  height: 100%;
  color: var(--text-faint);
}
</style>
