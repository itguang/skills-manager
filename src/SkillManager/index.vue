<script lang="ts" setup>
import { computed, defineAsyncComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FilterPopover from './components/FilterPopover.vue'
import ListToolbar from './components/ListToolbar.vue'
import ProjectSwitcher from './components/ProjectSwitcher.vue'
import SettingsView from './components/SettingsView.vue'
import SkillDetailDrawer from './components/SkillDetailDrawer.vue'
import SkillRow from './components/SkillRow.vue'
import type { AgentTab } from './components/ListToolbar.vue'
import type { SkillRowCommand } from './components/SkillRow.vue'
import type { ScanResult, Skill, SkillLocation } from './types'
import { AGENT_PRESETS, CUSTOM_AGENT_ID, getAgentName } from './agents'
import { useSettings } from './useSettings'
import { ALL_AGENTS, getSkillAgentIds, useSkillFilters } from './useSkillFilters'
import { compactDisplayPath, copyText, getErrorMessage, openPath, pickDirectory, showNotification } from './utils'

const props = defineProps({
  enterAction: {
    type: Object,
    default: () => ({})
  }
})

const PAGE_HEIGHT = 816
const SEARCH_PLACEHOLDER = '搜索 skill 名称、描述、标签'
const RESCAN_DELAY_MS = 300
// 入场动画只给首屏的行做错位延迟，避免长列表最后几行等太久才出现
const STAGGERED_ROW_LIMIT = 12

const { settings, activeProject, scanSources, sharedReaderIds, addProject } = useSettings()

// 编辑器依赖 Milkdown / CodeMirror，体积较大，只在第一次进入编辑时加载，不拖慢列表页打开速度
const SkillEditor = defineAsyncComponent(() => import('./editor/SkillEditor.vue'))

const currentView = ref<'list' | 'settings' | 'editor'>('list')
const editingSkill = ref<Skill | null>(null)
const skillEditorRef = ref<{ requestClose: () => Promise<void> } | null>(null)
const isLoading = ref(false)
const scanResult = ref<ScanResult>({ sources: [], skills: [], problems: [] })
const busySkillIds = ref<string[]>([])
const isDetailOpen = ref(false)
const detailSkillId = ref('')
const activeRowIndex = ref(-1)
const skillListElement = ref<HTMLElement | null>(null)

const skills = computed(() => scanResult.value.skills)
const {
  filters,
  filteredSkills,
  matchedSkillCount,
  agentCounts,
  categories,
  activeFilterCount,
  resetPopoverFilters,
  resetAllFilters
} = useSkillFilters(skills, sharedReaderIds)

const detailSkill = computed(() => skills.value.find((skill) => skill.id === detailSkillId.value) || null)
const brokenLinkCount = computed(() => scanResult.value.problems.filter((problem) => problem.kind === 'broken-link').length)
const disabledSkillCount = computed(() => skills.value.filter((skill) => skill.disabled).length)
const hasAnyFilter = computed(() => Boolean(filters.keyword) || filters.agentId !== ALL_AGENTS || activeFilterCount.value > 0)

// 只显示有 skill 的 agent 标签；当前选中的标签即使数量变成 0 也保留，避免标签突然消失
const agentTabs = computed<AgentTab[]>(() => {
  const tabs: AgentTab[] = [{ id: ALL_AGENTS, label: '全部', count: matchedSkillCount.value }]
  const agentIds = [...AGENT_PRESETS.map((preset) => preset.id), CUSTOM_AGENT_ID]

  for (const agentId of agentIds) {
    const count = agentCounts.value.get(agentId) || 0
    if (count === 0 && filters.agentId !== agentId) continue
    const label = agentId === CUSTOM_AGENT_ID ? '自定义' : AGENT_PRESETS.find((preset) => preset.id === agentId)!.shortName
    tabs.push({ id: agentId, label, count })
  }
  return tabs
})

const summaryText = computed(() => {
  const shownCount = filteredSkills.value.length
  const totalCount = skills.value.length
  const countText = shownCount === totalCount ? `${totalCount} 个 skill` : `${shownCount} / ${totalCount} 个 skill`
  return disabledSkillCount.value > 0 ? `${countText} · ${disabledSkillCount.value} 个已停用` : countText
})

function isSkillBusy (skillId: string) {
  return busySkillIds.value.includes(skillId)
}

async function runWithBusySkill (skill: Skill, task: () => Promise<void> | void) {
  if (isSkillBusy(skill.id)) return
  busySkillIds.value = [...busySkillIds.value, skill.id]
  try {
    await task()
  } finally {
    busySkillIds.value = busySkillIds.value.filter((id) => id !== skill.id)
  }
}

// 与 public/preload/services.js 中的 PRELOAD_VERSION 保持一致
const REQUIRED_PRELOAD_VERSION = 3
const STALE_PRELOAD_MESSAGE = '插件已更新，但 uTools 还在运行旧版本的后台脚本。请在 uTools 中「结束运行」本插件后重新打开。'

// preload 改动不会热更新：页面是新的、preload 是旧的时，接口返回的数据结构对不上，必须让用户重启插件
function checkPreloadVersion () {
  if (typeof window.services?.scanSkills !== 'function') {
    return 'preload 未加载，请在 uTools 中结束插件后重新打开'
  }
  if (window.services.version !== REQUIRED_PRELOAD_VERSION) {
    return STALE_PRELOAD_MESSAGE
  }
  return ''
}

const preloadError = ref(checkPreloadVersion())

function refreshSkills () {
  isLoading.value = true
  try {
    preloadError.value = checkPreloadVersion()
    if (preloadError.value) {
      scanResult.value = { sources: [], skills: [], problems: [] }
      return
    }
    scanResult.value = window.services.scanSkills({
      sources: scanSources.value,
      projectRoot: activeProject.value?.path || ''
    })
  } catch (error) {
    showNotification(getErrorMessage(error, '扫描 skill 目录失败'))
  } finally {
    isLoading.value = false
  }
}

let rescanTimer: ReturnType<typeof setTimeout> | undefined

function scheduleRescan () {
  clearTimeout(rescanTimer)
  rescanTimer = setTimeout(refreshSkills, RESCAN_DELAY_MS)
}

// 用 uTools 顶部主输入框作为搜索框，页面内不再单独放搜索输入
function mountSearchInput () {
  window.utools.setSubInput(({ text }) => {
    filters.keyword = text
  }, SEARCH_PLACEHOLDER, true)

  if (filters.keyword) {
    window.utools.setSubInputValue(filters.keyword)
  }
}

function openSettings () {
  isDetailOpen.value = false
  currentView.value = 'settings'
  window.utools.removeSubInput()
}

function closeSettings () {
  currentView.value = 'list'
  mountSearchInput()
}

// 编辑器需要整个窗口空间，进入时隐藏顶部搜索框，返回列表时恢复
function openEditor (skill: Skill) {
  if (preloadError.value) {
    showNotification(preloadError.value)
    return
  }
  isDetailOpen.value = false
  editingSkill.value = skill
  currentView.value = 'editor'
  window.utools.removeSubInput()
}

function closeEditor () {
  currentView.value = 'list'
  editingSkill.value = null
  mountSearchInput()
}

function clearAllFilters () {
  resetAllFilters()
  window.utools.setSubInputValue('')
}

function handleAddProject () {
  const selectedPath = pickDirectory('选择项目根目录')
  if (selectedPath) addProject(selectedPath)
}

function openDetail (skill: Skill, rowIndex: number) {
  activeRowIndex.value = rowIndex
  detailSkillId.value = skill.id
  isDetailOpen.value = true
}

function toggleSkill (skill: Skill) {
  runWithBusySkill(skill, () => {
    try {
      const result = window.services.setSkillDisabled({ realPath: skill.realPath, disabled: !skill.disabled })
      skill.disabled = result.disabled
      skill.skillFilePath = result.skillFilePath
      ElMessage.success(`已${result.disabled ? '停用' : '启用'} ${skill.name}`)
    } catch (error) {
      showNotification(getErrorMessage(error, '切换 skill 状态失败'))
    }
  })
}

// 扫描目录里不是软链接的那个位置才是真正存放 skill 的目录，删除时只把它移到废纸篓
function findDirectoryLocation (skill: Skill) {
  return skill.locations.find((location) => !location.isSymlink) || null
}

function buildDeleteMessage (skill: Skill) {
  const symlinkLocations = skill.locations.filter((location) => location.isSymlink)
  const directoryLocation = findDirectoryLocation(skill)
  const lines: string[] = []

  if (directoryLocation) {
    lines.push(`目录 ${compactDisplayPath(directoryLocation.entryPath)} 将移到废纸篓`)
  }
  for (const location of symlinkLocations) {
    lines.push(`解除软链接 ${compactDisplayPath(location.entryPath)}`)
  }
  if (!directoryLocation) {
    lines.push('软链接指向的目录不会被删除')
  }

  // 用 VNode 渲染多行提示，避免开启 dangerouslyUseHTMLString
  return h('div', lines.map((line) => h('p', { style: 'margin: 0 0 4px' }, line)))
}

async function deleteSkill (skill: Skill) {
  try {
    await ElMessageBox.confirm(buildDeleteMessage(skill), `删除「${skill.name}」`, {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
  } catch (cancelled) {
    return
  }

  await runWithBusySkill(skill, async () => {
    try {
      for (const location of skill.locations.filter((item) => item.isSymlink)) {
        window.services.unlinkSkillLocation({ entryPath: location.entryPath })
      }
      const directoryLocation = findDirectoryLocation(skill)
      if (directoryLocation) {
        await window.utools.shellTrashItem(directoryLocation.entryPath)
      }
      isDetailOpen.value = false
      ElMessage.success(`已删除 ${skill.name}`)
    } catch (error) {
      showNotification(getErrorMessage(error, '删除 skill 失败'))
    }
  })
  refreshSkills()
}

async function unlinkLocation (skill: Skill, location: SkillLocation) {
  try {
    await ElMessageBox.confirm(
      `解除 ${getAgentName(location.agentId)} 中指向「${skill.name}」的软链接？原目录不受影响。`,
      '解除链接',
      { type: 'warning', confirmButtonText: '解除', cancelButtonText: '取消' }
    )
  } catch (cancelled) {
    return
  }

  await runWithBusySkill(skill, () => {
    try {
      window.services.unlinkSkillLocation({ entryPath: location.entryPath })
      ElMessage.success('已解除链接')
    } catch (error) {
      showNotification(getErrorMessage(error, '解除链接失败'))
    }
  })
  refreshSkills()
}

async function cleanBrokenLinks () {
  const brokenLinks = scanResult.value.problems.filter((problem) => problem.kind === 'broken-link')

  try {
    await ElMessageBox.confirm(`将删除 ${brokenLinks.length} 个指向已不存在目录的软链接。`, '清理失效链接', {
      type: 'warning',
      confirmButtonText: '清理',
      cancelButtonText: '取消'
    })
  } catch (cancelled) {
    return
  }

  const failedPaths: string[] = []
  for (const problem of brokenLinks) {
    try {
      window.services.unlinkSkillLocation({ entryPath: problem.entryPath })
    } catch (error) {
      failedPaths.push(problem.entryPath)
    }
  }

  if (failedPaths.length > 0) {
    showNotification(`有 ${failedPaths.length} 个链接清理失败：${failedPaths.map(compactDisplayPath).join('，')}`)
  } else {
    ElMessage.success(`已清理 ${brokenLinks.length} 个失效链接`)
  }
  refreshSkills()
}

function handleRowCommand (skill: Skill, command: SkillRowCommand) {
  switch (command) {
    case 'open-directory':
      openPath(skill.path)
      break
    case 'edit':
      openEditor(skill)
      break
    case 'copy-name':
      copyText(skill.name, '已复制名称')
      break
    case 'copy-path':
      copyText(skill.path, '已复制路径')
      break
    case 'delete':
      deleteSkill(skill)
      break
  }
}

function scrollActiveRowIntoView () {
  nextTick(() => {
    const rowElement = skillListElement.value?.children[activeRowIndex.value]
    rowElement?.scrollIntoView({ block: 'nearest' })
  })
}

function isTypingInPage (event: KeyboardEvent) {
  // 事件目标可能是 window / document，它们没有 closest 方法
  const target = event.target
  return target instanceof Element && Boolean(target.closest('input, textarea, .el-popper'))
}

// 监听整个页面的方向键和回车，让用户不用鼠标也能在列表里选择、打开详情
function handleKeydown (event: KeyboardEvent) {
  if (currentView.value !== 'list' || isDetailOpen.value || isTypingInPage(event)) return

  const lastIndex = filteredSkills.value.length - 1
  if (lastIndex < 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeRowIndex.value = Math.min(activeRowIndex.value + 1, lastIndex)
    scrollActiveRowIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeRowIndex.value = Math.max(activeRowIndex.value - 1, 0)
    scrollActiveRowIntoView()
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e' && activeRowIndex.value >= 0) {
    event.preventDefault()
    openEditor(filteredSkills.value[activeRowIndex.value])
  } else if (event.key === 'Enter' && activeRowIndex.value >= 0) {
    event.preventDefault()
    openDetail(filteredSkills.value[activeRowIndex.value], activeRowIndex.value)
  }
}

// 搜索时默认高亮第一条，按回车即可直接打开详情
watch(() => [filters.keyword, filters.agentId, filters.status, filters.scope, filters.category, filters.specIssuesOnly], () => {
  activeRowIndex.value = filters.keyword && filteredSkills.value.length > 0 ? 0 : -1
})

watch(() => filteredSkills.value.length, (length) => {
  if (activeRowIndex.value >= length) activeRowIndex.value = length - 1
})

// 只在影响扫描结果的配置变化时重新扫描，修改项目名称等不会触发
watch(() => JSON.stringify([scanSources.value, activeProject.value?.path || '']), scheduleRescan)

watch(() => props.enterAction, () => {
  // 编辑器有未保存内容时不能被重新进入插件直接冲掉，交给编辑器自己确认
  if (currentView.value === 'editor') {
    skillEditorRef.value?.requestClose()
    return
  }
  currentView.value = 'list'
  isDetailOpen.value = false
  window.utools.setExpendHeight(PAGE_HEIGHT)
  mountSearchInput()
  refreshSkills()
})

onMounted(() => {
  refreshSkills()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  clearTimeout(rescanTimer)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="skill-manager">
    <Transition name="view-fade" mode="out-in">
      <div v-if="currentView === 'list'" key="list" class="list-view">
        <header class="list-header">
          <ListToolbar
            v-model:active-agent-id="filters.agentId"
            :agent-tabs="agentTabs"
            :is-loading="isLoading"
            @open-settings="openSettings"
            @refresh="refreshSkills"
          >
            <template #filters>
              <FilterPopover
                v-model:category="filters.category"
                v-model:scope="filters.scope"
                v-model:spec-issues-only="filters.specIssuesOnly"
                v-model:status="filters.status"
                :active-count="activeFilterCount"
                :categories="categories"
                @reset="resetPopoverFilters"
              />
            </template>
          </ListToolbar>

          <div class="list-summary">
            <ProjectSwitcher
              v-model="settings.activeProjectId"
              :projects="settings.projects"
              @add-project="handleAddProject"
              @manage-projects="openSettings"
            />
            <span class="summary-divider" />
            <span>{{ summaryText }}</span>
            <button v-if="brokenLinkCount" class="summary-warning" type="button" @click="openSettings">
              {{ brokenLinkCount }} 个失效链接
            </button>
            <span class="summary-hint">↑↓ 选择 · Enter 详情 · ⌘E 编辑</span>
          </div>
        </header>

        <el-alert
          v-if="preloadError"
          class="preload-alert"
          :closable="false"
          :title="preloadError"
          show-icon
          type="warning"
        />

        <el-scrollbar class="list-scroll">
          <div v-if="filteredSkills.length" ref="skillListElement" class="skill-list">
            <SkillRow
              v-for="(skill, index) in filteredSkills"
              :key="skill.id"
              :active="index === activeRowIndex"
              :agent-ids="getSkillAgentIds(skill, sharedReaderIds)"
              :busy="isSkillBusy(skill.id)"
              :skill="skill"
              :style="{ '--row-index': Math.min(index, STAGGERED_ROW_LIMIT) }"
              @command="(command) => handleRowCommand(skill, command)"
              @open="openDetail(skill, index)"
              @toggle="toggleSkill(skill)"
            />
          </div>

          <el-empty
            v-else-if="!isLoading && !preloadError"
            :description="skills.length === 0 ? '没有扫描到 skill' : '没有匹配的 skill'"
            :image-size="64"
          >
            <el-button v-if="hasAnyFilter" size="small" @click="clearAllFilters">清除筛选</el-button>
            <el-button v-else plain size="small" type="primary" @click="openSettings">检查目录配置</el-button>
          </el-empty>
        </el-scrollbar>
      </div>

      <SkillEditor
        v-else-if="currentView === 'editor' && editingSkill"
        key="editor"
        ref="skillEditorRef"
        :skill="editingSkill"
        @close="closeEditor"
        @saved="refreshSkills"
      />

      <SettingsView
        v-else
        key="settings"
        :is-loading="isLoading"
        :problems="scanResult.problems"
        :scanned-sources="scanResult.sources"
        @back="closeSettings"
        @clean-broken-links="cleanBrokenLinks"
        @rescan="refreshSkills"
      />
    </Transition>

    <SkillDetailDrawer
      v-model="isDetailOpen"
      :agent-ids="detailSkill ? getSkillAgentIds(detailSkill, sharedReaderIds) : []"
      :busy="detailSkill ? isSkillBusy(detailSkill.id) : false"
      :skill="detailSkill"
      @delete="detailSkill && deleteSkill(detailSkill)"
      @edit="detailSkill && openEditor(detailSkill)"
      @toggle="detailSkill && toggleSkill(detailSkill)"
      @unlink-location="(location) => detailSkill && unlinkLocation(detailSkill, location)"
    />
  </div>
</template>

<style scoped>
.skill-manager {
  height: 100%;
  color: var(--text);
}

.list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--surface);
}

.list-header {
  display: grid;
  gap: 6px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border);
}

.list-summary {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-left: -6px;
  color: var(--text-faint);
  font-size: 12px;
}

.summary-divider {
  width: 1px;
  height: 10px;
  margin: 0 -2px;
  background: var(--border-strong);
}

.summary-warning {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--warning);
  font-size: 12px;
  cursor: pointer;
}

.summary-warning:hover {
  text-decoration: underline;
}

.summary-hint {
  margin-left: auto;
}

.preload-alert {
  margin: 8px 12px 0;
  width: auto;
}

.list-scroll {
  flex: 1;
  min-height: 0;
}

.skill-list {
  display: grid;
  gap: 1px;
  padding: 6px;
}

.skill-list > * {
  animation: row-in 0.22s ease both;
  animation-delay: calc(var(--row-index, 0) * 16ms);
}

.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.view-fade-enter-from {
  opacity: 0;
  transform: translateX(8px);
}

.view-fade-leave-to {
  opacity: 0;
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
</style>
