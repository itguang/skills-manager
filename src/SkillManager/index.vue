<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Delete, DocumentCopy, FolderOpened, PriceTag, Setting, Tickets, User, Collection } from '@element-plus/icons-vue'

const props = defineProps({
  enterAction: {
    type: Object,
    default: () => ({})
  }
})

const STORAGE_KEYS = {
  directories: 'skills-manager.directories',
  projectRoot: 'skills-manager.projectRoot'
}

const PAGE_HEIGHT = 816
const DESCRIPTION_PREVIEW_LINE_COUNT = 2
const DESCRIPTION_EXPAND_LABEL = '查看更多...'
const DESCRIPTION_COLLAPSE_LABEL = '收起'
const TOOLBAR_SELECT_POPPER_OPTIONS = {
  modifiers: [
    {
      name: 'flip',
      enabled: false
    }
  ]
}

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'enabled', label: '仅启用' },
  { value: 'disabled', label: '仅禁用' }
]

const DEFAULT_DIRECTORY_CONFIGS = [
  {
    id: 'preset-opencode-project',
    label: '项目 OpenCode 技能',
    path: '${projectRoot}/.opencode/skills',
    source: 'preset'
  },
  {
    id: 'preset-opencode-global',
    label: '全局 OpenCode 技能',
    path: '~/.config/opencode/skills',
    source: 'preset'
  },
  {
    id: 'preset-claude-project',
    label: '项目 Claude 技能',
    path: '${projectRoot}/.claude/skills',
    source: 'preset'
  },
  {
    id: 'preset-codex-project',
    label: '项目 Codex 技能',
    path: '${projectRoot}/.codex/skills',
    source: 'preset'
  },
  {
    id: 'preset-claude-global',
    label: '全局 Claude 技能',
    path: '~/.claude/skills',
    source: 'preset'
  },
  {
    id: 'preset-codex-global',
    label: '全局 Codex 技能',
    path: '~/.codex/skills',
    source: 'preset'
  },
  {
    id: 'preset-agents-project',
    label: '项目共享技能',
    path: '${projectRoot}/.agents/skills',
    source: 'preset'
  },
  {
    id: 'preset-agents-global',
    label: '全局共享技能',
    path: '~/.agents/skills',
    source: 'preset'
  }
]

const DEFAULT_DIRECTORY_LABELS = new Map(DEFAULT_DIRECTORY_CONFIGS.map((item) => [item.id, item.label]))
const PROJECT_DISPLAY_ONLY_DIRECTORY_IDS = new Set([
  'preset-opencode-project',
  'preset-claude-project',
  'preset-codex-project',
  'preset-agents-project'
])

function getStorageItem (key: string, fallbackValue: any) {
  try {
    const value = window.utools.dbStorage.getItem(key)
    return value ?? fallbackValue
  } catch (error) {
    return fallbackValue
  }
}

function setStorageItem (key: string, value: any) {
  let safeValue = value

  if (value && typeof value === 'object') {
    try {
      safeValue = JSON.parse(JSON.stringify(value))
    } catch (error) {
      safeValue = null
    }
  }

  window.utools.dbStorage.setItem(key, safeValue)
}

function removeStorageItem (key: string) {
  if (typeof window.utools.dbStorage.removeItem !== 'function') return
  window.utools.dbStorage.removeItem(key)
}

function mergeDirectoryConfigs (savedConfigs: any[]) {
  const savedItems = Array.isArray(savedConfigs) ? savedConfigs : []
  const savedById = new Map(savedItems.map((item) => [item.id, item]))

  const mergedDefaults = DEFAULT_DIRECTORY_CONFIGS.map((item) => ({
    ...savedById.get(item.id),
    ...item
  }))

  return mergedDefaults
}

const currentView = ref<'list' | 'settings'>('list')
const projectRoot = ref('')
const directoryConfigs = ref<any[]>([])
const scannedDirectories = ref<any[]>([])
const skills = ref<any[]>([])
const skillKeyword = ref('')
const selectedDirectoryIds = ref<string[]>([])
const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const categoryKeyword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const skillSwitchingIds = ref<string[]>([])
const skillDeletingIds = ref<string[]>([])
const expandedSkillDescriptionIds = ref<string[]>([])
const overflowingSkillDescriptionIds = ref<string[]>([])
const skillDescriptionMeasureElements = new Map<string, HTMLElement>()
const homeDirectory = ref('')

function persistSettings () {
  const normalizedProjectRoot = typeof projectRoot.value === 'string' ? projectRoot.value.trim() : ''
  if (normalizedProjectRoot) {
    setStorageItem(STORAGE_KEYS.projectRoot, normalizedProjectRoot)
  } else {
    removeStorageItem(STORAGE_KEYS.projectRoot)
  }
  setStorageItem(STORAGE_KEYS.directories, directoryConfigs.value)
}

function loadSettings () {
  const savedProjectRoot = getStorageItem(STORAGE_KEYS.projectRoot, '')
  projectRoot.value = typeof savedProjectRoot === 'string' ? savedProjectRoot : ''
  directoryConfigs.value = mergeDirectoryConfigs(getStorageItem(STORAGE_KEYS.directories, DEFAULT_DIRECTORY_CONFIGS))
}

function showNotification (message: string) {
  window.utools.showNotification(message)
}

function normalizePath (value: string) {
  return value.replace(/\\/g, '/')
}

function compactDisplayPath (rawPath: string) {
  const normalizedPath = normalizePath(rawPath || '')
  const normalizedHome = normalizePath(homeDirectory.value || '')

  if (normalizedHome && normalizedPath.startsWith(`${normalizedHome}/`)) {
    return `~${normalizedPath.slice(normalizedHome.length)}`
  }

  if (normalizedHome && normalizedPath === normalizedHome) {
    return '~'
  }

  return normalizedPath
}

function getSkillDisplayPath (skill: any) {
  const directoryPath = typeof skill?.directoryPath === 'string' ? skill.directoryPath : ''
  const skillDirPath = typeof skill?.skillDirPath === 'string' ? skill.skillDirPath : ''

  if (directoryPath) {
    return compactDisplayPath(directoryPath)
  }

  if (!skillDirPath) return ''

  const normalizedSkillDirPath = normalizePath(skillDirPath)
  const compactedPath = normalizedSkillDirPath.replace(/\/[^/]+$/, '')
  return compactDisplayPath(compactedPath)
}

function openSkillDirectory (skill: any) {
  const skillDirPath = typeof skill?.skillDirPath === 'string' ? skill.skillDirPath : ''

  if (!skillDirPath) {
    showNotification('未找到 skill 目录')
    return
  }

  try {
    const opened = window.utools.shellOpenPath(skillDirPath)
    if (opened === false) {
      showNotification('打开 skill 目录失败')
    }
  } catch (error: any) {
    showNotification(error?.message || '打开 skill 目录失败')
  }
}

function copySkillName (skill: any) {
  const name = typeof skill?.name === 'string' ? skill.name.trim() : ''

  if (!name) {
    ElMessage.error('skill 名称为空，无法复制')
    return
  }

  try {
    const copied = window.utools.copyText(name)
    if (copied === false) {
      ElMessage.error('复制 skill 名称失败')
      return
    }
    ElMessage.success('复制成功')
  } catch (error: any) {
    ElMessage.error(error?.message || '复制 skill 名称失败')
  }
}

async function refreshSkills () {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = window.services.scanSkills({
      directories: directoryConfigs.value,
      projectRoot: projectRoot.value
    })

    scannedDirectories.value = result.directories
    skills.value = result.skills
  } catch (error: any) {
    scannedDirectories.value = []
    skills.value = []
    errorMessage.value = error?.message || '读取 skill 目录失败'
  } finally {
    isLoading.value = false
  }
}

async function handleQueryClick () {
  await refreshSkills()
  if (errorMessage.value) {
    ElMessage.error(errorMessage.value)
    return
  }

  ElMessage.success(`查询完成，共 ${filteredSkills.value.length} 条`)
}

function openSettings () {
  currentView.value = 'settings'
}

async function closeSettings () {
  currentView.value = 'list'
  await refreshSkills()
}

function resetDefaultDirectories () {
  directoryConfigs.value = DEFAULT_DIRECTORY_CONFIGS.map((item) => ({ ...item }))
  persistSettings()
  refreshSkills()
  showNotification('已恢复默认目录配置')
}

function extractDialogDirectoryPath (result: any) {
  // 处理 undefined 或 null
  if (!result) return ''

  // 处理 Electron/uTools 可能返回的对象格式 { canceled: boolean, filePaths: string[] }
  if (typeof result === 'object' && !Array.isArray(result)) {
    if (Array.isArray(result.filePaths) && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    // 处理可能的其他对象格式
    if (typeof result.path === 'string') return result.path
    if (typeof result.filePath === 'string') return result.filePath
    return ''
  }

  // 处理字符串数组格式
  if (!Array.isArray(result) || result.length === 0) return ''

  const first = result[0]

  if (typeof first === 'string') {
    return first
  }

  if (first && typeof first === 'object') {
    if (typeof first.path === 'string') return first.path
    if (typeof first.filePath === 'string') return first.filePath
  }

  return ''
}

function browseProjectRoot () {
  const directories = window.utools.showOpenDialog({
    title: '选择项目根目录',
    properties: ['openDirectory']
  })

  const selectedPath = extractDialogDirectoryPath(directories)
  if (!selectedPath) return
  projectRoot.value = selectedPath
}

function clearProjectRoot () {
  projectRoot.value = ''
}

function browseDirectoryConfig (directory: any) {
  const directories = window.utools.showOpenDialog({
    title: `选择 ${getDirectoryDisplayLabel(directory)} 目录`,
    properties: ['openDirectory']
  })

  const selectedPath = extractDialogDirectoryPath(directories)
  if (!selectedPath) return
  directory.path = selectedPath
}

function isProjectDisplayOnlyDirectory (directory: any) {
  return PROJECT_DISPLAY_ONLY_DIRECTORY_IDS.has(directory?.id)
}

function getProjectDirectoryResolvedPath (directory: any) {
  const rawPath = typeof directory?.path === 'string' ? directory.path : ''
  const normalizedProjectRoot = typeof projectRoot.value === 'string' ? projectRoot.value.trim() : ''

  if (!isProjectDisplayOnlyDirectory(directory)) return rawPath
  if (!normalizedProjectRoot) return rawPath
  return rawPath.replaceAll('${projectRoot}', normalizedProjectRoot)
}

function getDirectoryScanState (directoryId: string) {
  return scannedDirectories.value.find((item) => item.id === directoryId)
}

function getDirectoryDisplayLabel (directory: any) {
  return DEFAULT_DIRECTORY_LABELS.get(directory.id) || directory.label || '自定义目录'
}

function getDirectoryStateText (directoryId: string) {
  const state = getDirectoryScanState(directoryId)

  if (!state) return '等待扫描'
  if (state.reason === '未设置项目根目录') return ''
  return state.reason || state.resolvedPath || '等待扫描'
}

function getSkillDescriptionText (skill: any) {
  if (typeof skill?.description !== 'string') return '暂无说明'

  const description = skill.description.trim()
  return description || '暂无说明'
}

function getSkillVersionText (skill: any) {
  return typeof skill?.version === 'string' ? skill.version.trim() : ''
}

function getSkillAuthorText (skill: any) {
  return typeof skill?.author === 'string' ? skill.author.trim() : ''
}

function getSkillTags (skill: any) {
  const rawTags = Array.isArray(skill?.tags)
    ? skill.tags
    : typeof skill?.tags === 'string'
      ? [skill.tags]
      : []

  return rawTags
    .flatMap((tag: any) => (typeof tag === 'string' ? tag.split(/[,，]/) : []))
    .map((tag: string) => tag.trim())
    .filter(Boolean)
}

function setSkillDescriptionMeasureRef (skillId: string) {
  return (element: Element | null) => {
    if (element instanceof HTMLElement) {
      skillDescriptionMeasureElements.set(skillId, element)
      return
    }

    skillDescriptionMeasureElements.delete(skillId)
  }
}

function syncSkillDescriptionOverflowState () {
  if (currentView.value !== 'list') return

  const nextOverflowingIds = filteredSkills.value
    .filter((skill) => {
      const element = skillDescriptionMeasureElements.get(skill.id)
      if (!element) return false

      const description = getSkillDescriptionText(skill)
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || 16.2
      const maxHeight = lineHeight * DESCRIPTION_PREVIEW_LINE_COUNT + 1

      element.textContent = description

      return element.scrollHeight > maxHeight
    })
    .map((skill) => skill.id)

  overflowingSkillDescriptionIds.value = nextOverflowingIds
  expandedSkillDescriptionIds.value = expandedSkillDescriptionIds.value.filter((id) => nextOverflowingIds.includes(id))
}

async function updateSkillDescriptionOverflowState () {
  await nextTick()
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
  syncSkillDescriptionOverflowState()
}

function isSkillDescriptionExpanded (skillId: string) {
  return expandedSkillDescriptionIds.value.includes(skillId)
}

function shouldShowSkillDescriptionToggle (skillId: string) {
  return overflowingSkillDescriptionIds.value.includes(skillId)
}

function toggleSkillDescriptionExpansion (skillId: string) {
  if (expandedSkillDescriptionIds.value.includes(skillId)) {
    expandedSkillDescriptionIds.value = expandedSkillDescriptionIds.value.filter((id) => id !== skillId)
    return
  }

  expandedSkillDescriptionIds.value = [...expandedSkillDescriptionIds.value, skillId]
}

function handleWindowResize () {
  updateSkillDescriptionOverflowState()
}

function isSkillSwitching (skillId: string) {
  return skillSwitchingIds.value.includes(skillId)
}

function isSkillDeleting (skillId: string) {
  return skillDeletingIds.value.includes(skillId)
}

async function toggleSkillDisabled (skill: any) {
  if (!skill?.id || !skill?.skillDirPath || isSkillSwitching(skill.id) || isSkillDeleting(skill.id)) return

  skillSwitchingIds.value = [...skillSwitchingIds.value, skill.id]

  try {
    const nextDisabled = !skill.disabled
    window.services.setSkillDisabled({
      skillDirPath: skill.skillDirPath,
      disabled: nextDisabled
    })
    skill.disabled = nextDisabled
  } catch (error: any) {
    showNotification(error?.message || '切换 skill 状态失败')
  } finally {
    skillSwitchingIds.value = skillSwitchingIds.value.filter((id) => id !== skill.id)
  }
}

async function removeSkill (skill: any) {
  if (!skill?.id || !skill?.skillDirPath || isSkillDeleting(skill.id) || isSkillSwitching(skill.id)) return

  try {
    await ElMessageBox.confirm(
      `确认删除 skill「${skill.name}」目录吗？\n${skill.skillDirPath}`,
      '删除 Skill',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch (error) {
    return
  }

  skillDeletingIds.value = [...skillDeletingIds.value, skill.id]

  try {
    window.services.removeSkill({
      skillDirPath: skill.skillDirPath
    })

    expandedSkillDescriptionIds.value = expandedSkillDescriptionIds.value.filter((id) => id !== skill.id)
    overflowingSkillDescriptionIds.value = overflowingSkillDescriptionIds.value.filter((id) => id !== skill.id)
    skillDescriptionMeasureElements.delete(skill.id)

    await refreshSkills()
    showNotification(`已删除 ${skill.name}`)
  } catch (error: any) {
    showNotification(error?.message || '删除 skill 失败')
  } finally {
    skillDeletingIds.value = skillDeletingIds.value.filter((id) => id !== skill.id)
  }
}

const filteredSkills = computed(() => {
  const keyword = skillKeyword.value.trim().toLowerCase()
  const category = categoryKeyword.value.trim().toLowerCase()
  const selectedIds = new Set(selectedDirectoryIds.value)

  return skills.value.filter((skill) => {
    if (selectedIds.size > 0 && !selectedIds.has(skill.directoryId)) return false
    if (statusFilter.value === 'enabled' && skill.disabled) return false
    if (statusFilter.value === 'disabled' && !skill.disabled) return false
    if (category && !skill.category?.toLowerCase().includes(category)) return false
    if (!keyword) return true

    return [
      skill.name,
      skill.description,
      skill.directoryLabel,
      getSkillVersionText(skill),
      getSkillAuthorText(skill),
      getSkillTags(skill).join(' ')
    ].join(' ').toLowerCase().includes(keyword)
  })
})

const healthyDirectoryCount = computed(() => scannedDirectories.value.filter((directory) => !directory.reason).length)

const searchableDirectoryOptions = computed(() => scannedDirectories.value
  .filter((directory) => !directory.reason && directory.totalSkills > 0)
  .map((directory) => ({
    value: directory.id,
    label: `${getDirectoryDisplayLabel(directory)} (${directory.totalSkills})`
  })))

const directorySections = computed(() => {
  const globalItems = []
  const projectItems = []

  for (const directory of directoryConfigs.value) {
    if (directory.scope === 'global' || (typeof directory.id === 'string' && directory.id.endsWith('global'))) {
      globalItems.push(directory)
      continue
    }

    if (directory.scope === 'project' || (typeof directory.id === 'string' && directory.id.endsWith('project'))) {
      projectItems.push(directory)
    }
  }

  const sharedGlobalIndex = globalItems.findIndex((directory) =>
    directory?.id === 'preset-agents-global' || directory?.label === '全局共享技能'
  )
  if (sharedGlobalIndex > 0) {
    const [sharedGlobalItem] = globalItems.splice(sharedGlobalIndex, 1)
    globalItems.unshift(sharedGlobalItem)
  }

  return [
    { key: 'global', title: '全局 Skill 路径配置', items: globalItems },
    { key: 'project', title: '项目 Skill 配置', items: projectItems }
  ].filter((section) => section.items.length > 0)
})

watch([projectRoot, directoryConfigs], () => {
  persistSettings()
}, { deep: true })

watch(searchableDirectoryOptions, (options) => {
  const availableIds = new Set(options.map((option) => option.value))
  selectedDirectoryIds.value = selectedDirectoryIds.value.filter((directoryId) => availableIds.has(directoryId))
}, { immediate: true })

watch(currentView, () => {
  window.utools.setExpendHeight(PAGE_HEIGHT)
}, { immediate: true })

watch([filteredSkills, currentView, isLoading], () => {
  if (isLoading.value || currentView.value !== 'list') return
  updateSkillDescriptionOverflowState()
}, { flush: 'post' })

watch(() => props.enterAction, () => {
  currentView.value = 'list'
  window.utools.setExpendHeight(PAGE_HEIGHT)

  if (directoryConfigs.value.length > 0) {
    refreshSkills()
  }
}, { immediate: true })

onMounted(() => {
  try {
    homeDirectory.value = window.utools.getPath('home') || ''
  } catch (error) {
    homeDirectory.value = ''
  }

  loadSettings()
  refreshSkills()
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
})
</script>

<template>
  <div class="skill-manager">
    <Transition name="view-switch" mode="out-in">
      <section v-if="currentView === 'list'" key="list" class="page-shell">
        <section class="hero-toolbar panel-surface panel-animated">
          <div class="hero-toolbar-top"></div>

            <div class="hero-toolbar-bottom">
              <el-input
                v-model="skillKeyword"
                class="toolbar-search"
                clearable
                placeholder="搜索 skill 名称、描述或来源目录"
              />

              <el-select
                v-model="selectedDirectoryIds"
                class="toolbar-directory"
                clearable
                collapse-tags
                collapse-tags-tooltip
                multiple
                :disabled="searchableDirectoryOptions.length === 0"
                :max-collapse-tags="2"
                :offset="8"
                placeholder="筛选目录"
                popper-class="toolbar-select-popper"
                :popper-options="TOOLBAR_SELECT_POPPER_OPTIONS"
                placement="bottom-start"
              >
                <el-option
                  v-for="option in searchableDirectoryOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>

              <el-input
                v-model="categoryKeyword"
                class="toolbar-category"
                clearable
                placeholder="筛选分类"
              />

              <el-select
                v-model="statusFilter"
                class="toolbar-status"
                :offset="8"
                popper-class="toolbar-select-popper"
                :popper-options="TOOLBAR_SELECT_POPPER_OPTIONS"
                placement="bottom-start"
              >
                <el-option
                  v-for="option in STATUS_OPTIONS"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>

              <el-button :loading="isLoading" type="primary" @click="handleQueryClick" style="height: 38px;">查询</el-button>
            </div>
        </section>

        <el-alert
          v-if="errorMessage"
          :closable="false"
          :title="errorMessage"
          show-icon
          type="error"
        />

        <section v-loading="isLoading" class="list-panel panel-surface panel-animated">
            <div class="list-header">
              <div class="list-header-top">
                <div class="list-heading list-heading--inline">
                  <h2>Skills 列表</h2>

                  <div class="list-stats">
                    <el-tag effect="plain">已连接目录 {{ healthyDirectoryCount }}/{{ scannedDirectories.length }}</el-tag>
                    <el-tag effect="plain" type="success">列表结果 {{ filteredSkills.length }}</el-tag>
                  </div>
                </div>

                <button
                  class="icon-action-button"
                  type="button"
                  title="目录设置"
                  aria-label="目录设置"
                  @click="openSettings"
                >
                  <el-icon><Setting /></el-icon>
                </button>
              </div>
            </div>

          <el-empty
            v-if="!isLoading && filteredSkills.length === 0"
            description="没有可展示的 skill"
          >
            <el-button type="primary" plain @click="openSettings">检查目录配置</el-button>
          </el-empty>

          <el-scrollbar v-else class="skills-scrollbar">
            <div class="skills-list">
              <el-card
                v-for="(skill, index) in filteredSkills"
                :key="skill.id"
                :style="{ '--item-index': index }"
                :class="['skill-card', { 'is-disabled': skill.disabled }]"
                shadow="hover"
              >
                <div class="skill-top">
                  <div class="skill-main">
                    <div class="skill-title-row">
                      <div class="skill-title-main">
                        <el-button
                          class="skill-open-button"
                          :title="skill.skillDirPath"
                          link
                          type="primary"
                          @click="openSkillDirectory(skill)"
                        >
                          <el-icon><FolderOpened /></el-icon>
                        </el-button>
                        <span class="skill-name" :title="skill.name">{{ skill.name }}</span>
                        <el-button
                          class="skill-copy-button"
                          :aria-label="`复制 ${skill.name}`"
                          link
                          type="primary"
                          title="复制名称"
                          @click="copySkillName(skill)"
                        >
                          <el-icon><DocumentCopy /></el-icon>
                        </el-button>
                        <span
                          v-if="getSkillVersionText(skill)"
                          class="skill-inline-meta skill-inline-meta--version"
                          :title="`版本 ${getSkillVersionText(skill)}`"
                        >
                          <el-icon><Tickets /></el-icon>
                          <span>{{ getSkillVersionText(skill) }}</span>
                        </span>
                        <span
                          v-if="getSkillAuthorText(skill)"
                          class="skill-inline-meta"
                          :title="getSkillAuthorText(skill)"
                        >
                          <el-icon><User /></el-icon>
                          <span>{{ getSkillAuthorText(skill) }}</span>
                        </span>
                        <div v-if="getSkillTags(skill).length || skill.category" class="skill-tag-list">
                          <el-tag
                            v-if="skill.category"
                            class="skill-tag skill-tag--category"
                            type="info"
                            effect="light"
                            size="small"
                            round
                          >
                            <span class="skill-tag-content">
                              <el-icon><Collection /></el-icon>
                              <span>{{ skill.category }}</span>
                            </span>
                          </el-tag>
                          <span v-if="getSkillTags(skill).length" class="skill-tag-icon">
                            <el-icon><PriceTag /></el-icon>
                          </span>
                          <el-tag
                            v-for="tag in getSkillTags(skill)"
                            :key="`${skill.id}-${tag}`"
                            class="skill-tag"
                            type="primary"
                            effect="light"
                            size="small"
                            round
                          >
                            <span class="skill-tag-text">{{ tag }}</span>
                          </el-tag>
                        </div>
                      </div>

                      <div class="skill-actions">
                        <el-switch
                          class="skill-status-switch"
                          :disabled="isSkillDeleting(skill.id)"
                          :loading="isSkillSwitching(skill.id)"
                          :model-value="!skill.disabled"
                          active-text="启"
                          inactive-text="停"
                          inline-prompt
                          @change="toggleSkillDisabled(skill)"
                        />

                        <el-button
                          :aria-label="`删除 ${skill.name}`"
                          :disabled="isSkillSwitching(skill.id) || isSkillDeleting(skill.id)"
                          :icon="Delete"
                          :loading="isSkillDeleting(skill.id)"
                          circle
                          plain
                          title="删除"
                          type="danger"
                          @click="removeSkill(skill)"
                        />
                      </div>
                    </div>

                    <div class="skill-meta-row">
                      <el-tag effect="plain" size="small">{{ skill.directoryLabel || '未知目录' }}</el-tag>
                      <span class="skill-path" :title="getSkillDisplayPath(skill)">{{ getSkillDisplayPath(skill) }}</span>
                    </div>
                  </div>
                </div>

                <div class="skill-bottom">
                  <div class="skill-description-box">
                    <span
                      :ref="setSkillDescriptionMeasureRef(skill.id)"
                      class="skill-description-copy skill-description--measure"
                    >
                      {{ getSkillDescriptionText(skill) }}
                    </span>

                    <p
                      :class="[
                        'skill-description',
                        { 'is-expanded': isSkillDescriptionExpanded(skill.id) }
                      ]"
                    >
                      {{ getSkillDescriptionText(skill) }}
                    </p>

                    <el-button
                      v-if="shouldShowSkillDescriptionToggle(skill.id)"
                      class="skill-description-toggle"
                      link
                      type="primary"
                      @click="toggleSkillDescriptionExpansion(skill.id)"
                    >
                      {{ isSkillDescriptionExpanded(skill.id) ? DESCRIPTION_COLLAPSE_LABEL : DESCRIPTION_EXPAND_LABEL }}
                    </el-button>
                  </div>
                </div>
              </el-card>
            </div>
          </el-scrollbar>
        </section>
      </section>

      <section v-else key="settings" class="page-shell">
        <section class="settings-topbar panel-surface panel-animated">
          <button
            class="icon-action-button settings-back-button"
            type="button"
            title="返回列表"
            aria-label="返回列表"
            @click="closeSettings"
          >
            <el-icon><Back /></el-icon>
          </button>

          <div class="settings-copy">
            <span class="page-kicker">目录维护</span>
            <h2>目录配置</h2>
            <p>修改会自动保存，返回列表时会重新扫描。</p>
          </div>

          <div class="settings-actions">
            <el-button plain @click="resetDefaultDirectories">重置默认</el-button>
            <el-button :loading="isLoading" type="primary" @click="refreshSkills">立即扫描</el-button>
          </div>
        </section>

        <section class="settings-panel panel-surface panel-animated">
          <el-scrollbar class="settings-scrollbar">
            <div class="settings-layout">
              <section class="settings-summary-card">
                <div class="settings-summary-header">
                  <div>
                    <h3>扫描范围</h3>
                  </div>
                </div>

                <div class="settings-summary-grid">
                  <article class="summary-metric">
                    <span>已连接目录</span>
                    <strong>{{ healthyDirectoryCount }}</strong>
                  </article>
                  <article class="summary-metric">
                    <span>扫描目录</span>
                    <strong>{{ scannedDirectories.length }}</strong>
                  </article>
                  <article class="summary-metric">
                    <span>已发现 skill</span>
                    <strong>{{ skills.length }}</strong>
                  </article>
                </div>
              </section>

              <div class="directory-groups">
                <section
                  v-for="(section, sectionIndex) in directorySections"
                  :key="section.key"
                  :style="{ '--section-index': sectionIndex }"
                  class="directory-section"
                >
                    <div class="directory-section-header">
                      <div class="directory-section-copy">
                        <h3>{{ section.title }}</h3>
                      </div>
                    </div>

                  <div class="directory-section-body">
                    <section v-if="section.key === 'project'" class="project-root-panel project-root-panel--embedded">
                      <div class="project-root-copy">
                        <div>
                          <h3>项目技能根目录配置</h3>
                          <p>用于解析项目路径里的 ${projectRoot} 占位符</p>
                        </div>
                      </div>

                      <div class="project-root-input-row">
                        <el-input
                          v-model="projectRoot"
                          placeholder="用于解析项目路径里的 ${projectRoot} 占位符"
                        />
                        <div class="project-root-input-actions">
                          <el-button type="primary" plain @click="browseProjectRoot">选择</el-button>
                          <el-button plain @click="clearProjectRoot">清空</el-button>
                        </div>
                      </div>
                    </section>

                    <div class="directory-list">
                      <el-card
                        v-for="(directory, directoryIndex) in section.items"
                        :key="directory.id"
                        :style="{ '--item-index': directoryIndex }"
                        class="directory-card"
                        shadow="never"
                      >
                        <div class="directory-card-header">
                          <div class="directory-card-meta">
                            <span class="directory-name">{{ getDirectoryDisplayLabel(directory) }}</span>
                            <el-tag effect="plain" size="small" type="info">
                              {{ getDirectoryScanState(directory.id)?.totalSkills || 0 }} 个 skill
                            </el-tag>
                          </div>

                          <div v-if="!isProjectDisplayOnlyDirectory(directory)" class="directory-card-actions">
                            <el-button plain @click="browseDirectoryConfig(directory)">选择</el-button>
                          </div>
                        </div>

                        <el-input
                          v-if="!isProjectDisplayOnlyDirectory(directory)"
                          v-model="directory.path"
                          placeholder="支持 ~ 和 ${projectRoot}"
                        />
                        <el-input
                          v-else
                          :model-value="getProjectDirectoryResolvedPath(directory)"
                          placeholder="支持 ~ 和 ${projectRoot}"
                          readonly
                        />

                        <p class="directory-state">
                          {{ getDirectoryStateText(directory.id) || '项目路径未启用，设置项目根目录后自动生效' }}
                        </p>
                      </el-card>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </el-scrollbar>
        </section>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.skill-manager {
  height: 100%;
  padding: 12px;
  color: var(--text);
}

.page-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.panel-surface {
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow);
  backdrop-filter: blur(20px);
}

.panel-animated {
  animation: panel-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.hero-toolbar,
.settings-topbar,
.settings-panel {
  padding: 14px 16px;
}

.hero-toolbar {
  position: relative;
  overflow: visible;
  z-index: 3;
}

.settings-topbar {
  position: relative;
  display: grid;
  gap: 12px;
  align-items: stretch;
  padding-right: 68px;
}

.settings-back-button {
  position: absolute;
  top: 14px;
  right: 16px;
  z-index: 1;
}

.hero-toolbar::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(10, 122, 115, 0.12), transparent 26%),
    radial-gradient(circle at right center, rgba(120, 150, 175, 0.12), transparent 24%);
  pointer-events: none;
}

.hero-toolbar-top,
.hero-title-row,
.list-header,
.list-header-top,
.settings-topbar,
.settings-summary-header,
.project-root-copy,
.directory-section-header,
.directory-card-header,
.skill-top,
.skill-meta-row,
.skill-bottom,
.settings-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.hero-toolbar-top,
.list-header-top,
.settings-topbar,
.settings-summary-header,
.project-root-copy,
.directory-section-header,
.directory-card-header,
.skill-top {
  justify-content: space-between;
}

.page-copy,
.list-heading,
.settings-copy,
.directory-section-copy,
.skill-main {
  min-width: 0;
}

.skill-main {
  flex: 1 1 auto;
  width: 100%;
}

.page-copy--compact {
  position: relative;
  z-index: 1;
}

.page-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-soft);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-copy h1,
.settings-copy h2,
.settings-summary-header h3,
.project-root-copy h3,
.directory-section-copy h3,
.list-heading h2 {
  margin: 0;
  font-family: "Avenir Next", "IBM Plex Sans", "PingFang SC", sans-serif;
  letter-spacing: -0.04em;
}

.page-copy h1 {
  font-size: 26px;
  line-height: 1;
}

.settings-copy h2 {
  margin-top: 10px;
  font-size: 22px;
}

.settings-summary-header h3,
.project-root-copy h3,
.directory-section-copy h3,
.list-heading h2 {
  font-size: 16px;
}

.hero-title-row {
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.hero-title-row .page-kicker,
.hero-title-row h1,
.hero-title-row p {
  position: relative;
  z-index: 1;
}

.page-copy p,
.settings-copy p,
.settings-summary-header p,
.project-root-copy p,
.directory-section-copy p,
.list-heading p,
.skill-path,
.directory-state {
  color: var(--text-soft);
}

.page-copy p,
.settings-copy p,
.settings-summary-header p,
.project-root-copy p,
.directory-section-copy p,
.list-heading p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.page-actions,
.list-stats,
.skill-actions,
.directory-card-actions,
.settings-actions,
.settings-summary-grid,
.list-header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.project-root-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.project-root-input-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.list-header-actions {
  align-items: center;
}

.page-actions--compact {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  align-self: flex-start;
}

.list-heading--inline {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.icon-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-strong);
  color: var(--text-soft);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.icon-action-button:hover {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 28%, var(--border));
  background: color-mix(in srgb, var(--surface-strong) 88%, var(--brand) 12%);
  transform: translateY(-1px);
}

.icon-action-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--brand) 28%, transparent);
  outline-offset: 2px;
}

.icon-action-button svg {
  width: 18px;
  height: 18px;
}

.hero-toolbar-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.9fr) minmax(180px, 0.7fr) minmax(180px, 0.5fr) auto;
  gap: 10px;
  align-items: center;
  position: relative;
  z-index: 1;
  margin-top: 10px;
}

.list-panel,
.settings-panel {
  flex: 1;
  min-height: 0;
  position: relative;
}

.list-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  overflow: hidden;
  z-index: 1;
}

.list-header {
  align-items: stretch;
  flex-direction: column;
}

.list-header-top {
  align-items: center;
}

.list-stats {
  justify-content: flex-start;
  flex-wrap: nowrap;
}

.skills-scrollbar,
.settings-scrollbar {
  min-height: 0;
  flex: 1;
}

.skills-scrollbar :deep(.el-scrollbar__view),
.settings-scrollbar :deep(.el-scrollbar__view) {
  min-height: 100%;
}

.skills-list,
.settings-layout,
.directory-groups,
.directory-section-body,
.directory-list {
  display: grid;
  gap: 10px;
}

.skills-list {
  gap: 8px;
  padding-right: 2px;
}

.settings-layout {
  gap: 14px;
  padding-right: 2px;
}

.summary-metric {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.48);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.58);
}

.summary-metric span {
  display: block;
  color: var(--text-soft);
  font-size: 11px;
  line-height: 1.2;
}

.summary-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  line-height: 1;
  letter-spacing: -0.05em;
}

.skill-card,
.directory-card,
.settings-summary-card,
.project-root-panel {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
}

.skill-card {
  animation: item-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--item-index, 0) * 0.03s);
  overflow: hidden;
}

.skill-card.is-disabled {
  opacity: 0.82;
}

.skill-card :deep(.el-card__body),
.directory-card :deep(.el-card__body) {
  display: grid;
  gap: 10px;
  padding: 10px 16px 12px;
  overflow: hidden;
}

.settings-summary-card,
.project-root-panel,
.directory-section {
  padding: 14px 16px;
}

.settings-summary-card,
.project-root-panel {
  display: grid;
  gap: 12px;
}

.directory-section {
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  animation: item-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--section-index, 0) * 0.04s);
}

.directory-card {
  animation: item-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--item-index, 0) * 0.03s);
}

.skill-title-main,
.directory-card-meta,
.skill-inline-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.skill-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.skill-title-main {
  flex: 1;
  flex-wrap: nowrap;
  overflow: hidden;
}

.skill-meta-row {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.skill-open-button {
  flex: 0 0 auto;
  padding: 0;
  min-width: auto;
}

.skill-open-button :deep(svg),
.skill-copy-button :deep(svg) {
  width: 15px;
  height: 15px;
}

.skill-name {
  display: inline-block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 320px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.skill-copy-button {
  flex: 0 0 auto;
  padding: 0;
  min-width: auto;
}

.skill-inline-meta {
  flex: 0 0 auto;
  gap: 6px;
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-muted) 82%, transparent);
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
}

.skill-tag-list {
  display: flex;
  gap: 2px;
  align-items: center;
  min-width: 0;
  max-width: 42%;
  flex: 0 1 42%;
  flex-wrap: nowrap;
  overflow: hidden;
}

.skill-tag-icon {
  display: inline-flex;
  align-items: center;
  color: var(--accent-info);
  flex: 0 0 auto;
}

.skill-tag-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

.skill-tag {
  max-width: 180px;
  min-width: 0;
}

.skill-tag--category {
  flex: 0 0 auto;
}

.skill-tag :deep(.el-tag__content) {
  display: block;
  min-width: 0;
  font-size: 11px;
  line-height: 1.2;
}

.skill-tag-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.skill-tag-content :deep(.el-icon) {
  flex: 0 0 auto;
}

.skill-tag-content :deep(svg) {
  width: 12px;
  height: 12px;
}

.skill-tag-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-tag--category {
  flex: 0 0 auto;
}

.skill-tag :deep(.el-tag__content) {
  display: block;
  min-width: 0;
  font-size: 11px;
  line-height: 1.2;
}

.skill-tag-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.skill-tag-content :deep(.el-icon) {
  flex: 0 0 auto;
}

.skill-tag-content :deep(svg) {
  width: 12px;
  height: 12px;
}

.skill-tag-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-tag-icon {
  display: inline-flex;
  align-items: center;
  color: var(--accent-info);
  flex: 0 0 auto;
}

.skill-tag-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

.skill-tag-icon {
  display: inline-flex;
  align-items: center;
  color: var(--accent-info);
  flex: 0 0 auto;
}

.skill-tag :deep(.el-tag__content) {
  display: block;
  min-width: 0;
  font-size: 11px;
  line-height: 1.2;
}

.skill-tag-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-inline-meta span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-inline-meta :deep(svg) {
  width: 13px;
  height: 13px;
}

.skill-inline-meta--version {
  color: color-mix(in srgb, var(--accent-info) 72%, var(--text-soft));
}

.skill-path {
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
  flex-shrink: 0;
  justify-self: end;
  align-self: flex-start;
}

.skill-status-switch {
  --el-switch-on-color: var(--switch-on);
  --el-switch-off-color: var(--switch-off);
}

.skill-status-switch :deep(.el-switch__core) {
  border: 1px solid transparent;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.skill-status-switch :deep(.el-switch__inner .is-text) {
  color: rgba(255, 255, 255, 0.96);
  font-weight: 700;
}

.skill-status-switch.is-checked :deep(.el-switch__core) {
  background: linear-gradient(135deg, var(--switch-on) 0%, var(--switch-on-strong) 100%);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--switch-on-strong) 58%, transparent),
    0 0 18px color-mix(in srgb, var(--switch-on-strong) 34%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.skill-status-switch:not(.is-checked) :deep(.el-switch__core) {
  background: linear-gradient(135deg, var(--switch-off) 0%, var(--switch-off-strong) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 0 0 1px rgba(148, 163, 184, 0.18);
}

.skill-status-switch :deep(.el-switch__action) {
  box-shadow:
    0 3px 12px rgba(15, 23, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.56);
}

.skill-bottom {
  gap: 8px;
  justify-content: flex-start;
  align-items: flex-start;
}

.skill-description-box {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 90%;
  min-width: 0;
  width: 90%;
  max-width: 90%;
}

.skill-description,
.skill-description-copy {
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.skill-description {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.skill-description.is-expanded {
  display: block;
  overflow: visible;
}

.skill-description-toggle {
  --el-button-text-color: var(--accent-info);
  --el-button-hover-text-color: var(--accent-info-strong);
  --el-button-active-text-color: var(--accent-info-strong);
  align-self: flex-start;
  display: inline-flex;
  min-height: auto;
  margin-top: 4px;
  padding: 0;
  color: var(--accent-info);
  font-size: inherit;
  font-weight: 400;
  line-height: inherit;
  vertical-align: baseline;
}

.skill-description-toggle:hover,
.skill-description-toggle:focus-visible {
  color: var(--accent-info-strong);
}

.skill-description--measure {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 100%;
  visibility: hidden;
  pointer-events: none;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}

.directory-name {
  font-size: 13px;
  font-weight: 700;
}

.directory-state {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.hero-toolbar :deep(.el-input__wrapper),
.hero-toolbar :deep(.el-select__wrapper),
.project-root-panel :deep(.el-input__wrapper),
.directory-card :deep(.el-input__wrapper) {
  min-height: 38px;
  box-shadow: none;
}

.hero-toolbar :deep(.el-select__tags),
.hero-toolbar :deep(.el-select__tags-text) {
  max-width: 100%;
}

.skill-manager :deep(.toolbar-select-popper .el-select-dropdown__item) {
  font-size: 12px;
}

.view-switch-enter-active,
.view-switch-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.view-switch-enter-from,
.view-switch-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes item-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .hero-toolbar-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .hero-toolbar-bottom {
    grid-template-columns: minmax(0, 1fr) minmax(220px, 0.8fr) minmax(180px, 0.7fr) minmax(180px, 0.5fr) auto;
  }

  .list-header,
  .settings-topbar,
  .settings-summary-header,
  .project-root-copy,
  .directory-section-header,
  .directory-card-header,
  .skill-top,
  .skill-bottom {
    flex-direction: column;
    align-items: stretch;
  }

  .page-actions,
  .settings-actions,
  .directory-card-actions,
  .skill-actions,
  .project-root-input-actions {
    justify-content: flex-end;
  }

  .list-header-top {
    flex-direction: row;
    align-items: center;
  }

  .list-heading--inline {
    flex-wrap: wrap;
  }

  .list-stats {
    flex-wrap: wrap;
  }

}

@media (max-width: 720px) {
  .skill-manager {
    padding: 10px;
  }

  .hero-toolbar,
  .list-panel,
  .settings-topbar,
  .settings-panel,
  .settings-summary-card,
  .project-root-panel,
  .directory-section {
    padding: 12px;
  }

  .hero-toolbar-bottom {
    grid-template-columns: 1fr;
  }

  .project-root-input-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .settings-summary-grid {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
