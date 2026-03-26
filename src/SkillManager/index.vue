<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  enterAction: {
    type: Object,
    default: () => ({})
  }
})

const STORAGE_KEYS = {
  directories: 'skills-manager.directories',
  projectRoot: 'skills-manager.projectRoot',
  selectedDirectoryIds: 'skills-manager.selected-directory-ids'
}

const PAGE_HEIGHT = 544

const DEFAULT_DIRECTORY_CONFIGS = [
  {
    id: 'preset-opencode-project',
    label: '项目 OpenCode',
    path: '${projectRoot}/.opencode/skills',
    source: 'preset'
  },
  {
    id: 'preset-opencode-global',
    label: '全局 OpenCode',
    path: '~/.config/opencode/skills',
    source: 'preset'
  },
  {
    id: 'preset-claude-project',
    label: '项目 Claude 兼容',
    path: '${projectRoot}/.claude/skills',
    source: 'preset'
  },
  {
    id: 'preset-claude-global',
    label: '全局 Claude 兼容',
    path: '~/.claude/skills',
    source: 'preset'
  },
  {
    id: 'preset-agents-project',
    label: '项目代理兼容',
    path: '${projectRoot}/.agents/skills',
    source: 'preset'
  },
  {
    id: 'preset-agents-global',
    label: '全局代理兼容',
    path: '~/.agents/skills',
    source: 'preset'
  }
]

const DEFAULT_DIRECTORY_LABELS = new Map(DEFAULT_DIRECTORY_CONFIGS.map((item) => [item.id, item.label]))
const DIRECTORY_FILTER_ORDER = [
  'preset-opencode-global',
  'preset-claude-global',
  'preset-agents-global',
  'preset-opencode-project',
  'preset-claude-project',
  'preset-agents-project'
]

function getStorageItem (key: string, fallbackValue: any) {
  try {
    const value = window.utools.dbStorage.getItem(key)
    return value ?? fallbackValue
  } catch (error) {
    return fallbackValue
  }
}

function setStorageItem (key: string, value: any) {
  window.utools.dbStorage.setItem(key, value)
}

function mergeDirectoryConfigs (savedConfigs: any[]) {
  const savedItems = Array.isArray(savedConfigs) ? savedConfigs : []
  const savedById = new Map(savedItems.map((item) => [item.id, item]))
  const defaultIds = new Set(DEFAULT_DIRECTORY_CONFIGS.map((item) => item.id))

  const mergedDefaults = DEFAULT_DIRECTORY_CONFIGS.map((item) => ({
    ...savedById.get(item.id),
    ...item
  }))

  const customItems = savedItems.filter((item) => !defaultIds.has(item.id))

  return [...mergedDefaults, ...customItems]
}

const currentView = ref<'list' | 'settings'>('list')
const projectRoot = ref('')
const directoryConfigs = ref<any[]>([])
const scannedDirectories = ref<any[]>([])
const skills = ref<any[]>([])
const skillKeyword = ref('')
const statusFilter = ref('all')
const selectedDirectoryIds = ref<string[]>([])
const isDirectoryMenuOpen = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const skillSwitchingIds = ref<string[]>([])
const skillDeletingIds = ref<string[]>([])
const expandedSkillDescriptionIds = ref<string[]>([])
const overflowingSkillDescriptionIds = ref<string[]>([])
const skillDescriptionMeasureElements = new Map<string, HTMLElement>()
const homeDirectory = ref('')
const directoryFilterRef = ref<HTMLElement | null>(null)

function persistSettings () {
  setStorageItem(STORAGE_KEYS.projectRoot, projectRoot.value)
  setStorageItem(STORAGE_KEYS.directories, directoryConfigs.value)
  setStorageItem(STORAGE_KEYS.selectedDirectoryIds, selectedDirectoryIds.value)
}

function loadSettings () {
  projectRoot.value = getStorageItem(STORAGE_KEYS.projectRoot, '')
  directoryConfigs.value = mergeDirectoryConfigs(getStorageItem(STORAGE_KEYS.directories, DEFAULT_DIRECTORY_CONFIGS))
  const savedSelectedDirectoryIds = getStorageItem(STORAGE_KEYS.selectedDirectoryIds, [])
  const allDirectoryIds = directoryConfigs.value
    .filter((directory) => directory.source === 'custom' || projectRoot.value.trim() || !String(directory.id).endsWith('project'))
    .map((directory) => directory.id)

  selectedDirectoryIds.value = Array.isArray(savedSelectedDirectoryIds) && savedSelectedDirectoryIds.length > 0
    ? savedSelectedDirectoryIds.filter((id) => allDirectoryIds.includes(id))
    : allDirectoryIds
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

function browseProjectRoot () {
  const directories = window.utools.showOpenDialog({
    title: '选择项目根目录',
    properties: ['openDirectory']
  })

  if (!directories || directories.length === 0) return

  projectRoot.value = directories[0]
}

function browseDirectoryConfig (directory: any) {
  const directories = window.utools.showOpenDialog({
    title: `选择 ${directory.label} 目录`,
    properties: ['openDirectory']
  })

  if (!directories || directories.length === 0) return

  directory.path = directories[0]
}

function removeDirectoryConfig (directoryId: string) {
  directoryConfigs.value = directoryConfigs.value.filter((item) => item.id !== directoryId)
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

function isDirectorySelected (directoryId: string) {
  return selectedDirectoryIds.value.includes(directoryId)
}

function toggleDirectorySelection (directoryId: string) {
  if (selectedDirectoryIds.value.includes(directoryId)) {
    selectedDirectoryIds.value = selectedDirectoryIds.value.filter((id) => id !== directoryId)
    return
  }

  selectedDirectoryIds.value = [...selectedDirectoryIds.value, directoryId]
}

function toggleDirectoryMenu () {
  isDirectoryMenuOpen.value = !isDirectoryMenuOpen.value
}

function handleDocumentPointerDown (event: Event) {
  const dropdownElement = directoryFilterRef.value
  if (!dropdownElement) return
  if (dropdownElement.contains(event.target as Node)) return
  isDirectoryMenuOpen.value = false
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

      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || 16.2
      return element.scrollHeight > lineHeight * 2 + 1
    })
    .map((skill) => skill.id)

  overflowingSkillDescriptionIds.value = nextOverflowingIds
  expandedSkillDescriptionIds.value = expandedSkillDescriptionIds.value.filter((id) => nextOverflowingIds.includes(id))
}

async function updateSkillDescriptionOverflowState () {
  await nextTick()
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

  const confirmed = window.confirm(`确认删除 skill「${skill.name}」目录吗？\n\n${skill.skillDirPath}`)
  if (!confirmed) return

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
  const selectedIds = new Set(selectedDirectoryIds.value)

  return skills.value.filter((skill) => {
    if (directoryFilterOptions.value.length > 0 && selectedIds.size === 0) return false
    if (selectedIds.size > 0 && !selectedIds.has(skill.directoryId)) return false
    if (statusFilter.value === 'enabled' && skill.disabled) return false
    if (statusFilter.value === 'disabled' && !skill.disabled) return false
    if (!keyword) return true

    return `${skill.name} ${skill.description} ${skill.directoryLabel}`.toLowerCase().includes(keyword)
  })
})

const healthyDirectoryCount = computed(() => scannedDirectories.value.filter((directory) => !directory.reason).length)
const directoryFilterOptions = computed(() => {
  const directoryById = new Map(directoryConfigs.value.map((directory) => [directory.id, directory]))
  const availableDirectoryIds = new Set(
    scannedDirectories.value
      .filter((directory) => directory.exists && !directory.reason)
      .map((directory) => directory.id)
  )
  const options = []

  for (const directoryId of DIRECTORY_FILTER_ORDER) {
    if (directoryId.endsWith('project') && !projectRoot.value.trim()) continue
    if (!availableDirectoryIds.has(directoryId)) continue

    const directory = directoryById.get(directoryId)
    if (!directory) continue

    options.push({
      id: directory.id,
      label: getDirectoryDisplayLabel(directory)
    })
  }

  for (const directory of directoryConfigs.value) {
    if (DIRECTORY_FILTER_ORDER.includes(directory.id)) continue
    if (!availableDirectoryIds.has(directory.id)) continue

    options.push({
      id: directory.id,
      label: getDirectoryDisplayLabel(directory)
    })
  }

  return options
})
const selectedDirectoryText = computed(() => {
  if (directoryFilterOptions.value.length === 0) return '全部目录'
  if (selectedDirectoryIds.value.length === directoryFilterOptions.value.length) {
    return `全部目录 (${directoryFilterOptions.value.length})`
  }
  if (selectedDirectoryIds.value.length === 0) return '未选目录'
  return `已选目录 (${selectedDirectoryIds.value.length})`
})
const directorySections = computed(() => {
  const globalItems = []
  const projectItems = []
  const customItems = []

  for (const directory of directoryConfigs.value) {
    if (directory.source === 'custom') {
      customItems.push(directory)
      continue
    }

    if (typeof directory.id === 'string' && directory.id.endsWith('global')) {
      globalItems.push(directory)
      continue
    }

    if (typeof directory.id === 'string' && directory.id.endsWith('project')) {
      projectItems.push(directory)
      continue
    }

    customItems.push(directory)
  }

  return [
    { key: 'global', title: '全局路径配置', items: globalItems },
    { key: 'project', title: '项目路径配置', items: projectItems },
    { key: 'custom', title: '自定义路径配置', items: customItems }
  ].filter((section) => section.items.length > 0)
})

watch([projectRoot, directoryConfigs, selectedDirectoryIds], () => {
  persistSettings()
}, { deep: true })

watch(() => directoryFilterOptions.value.map((directory) => directory.id), (directoryIds) => {
  const validSelectedIds = selectedDirectoryIds.value.filter((id) => directoryIds.includes(id))

  if (validSelectedIds.length !== selectedDirectoryIds.value.length) {
    selectedDirectoryIds.value = validSelectedIds
  }
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
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <div class="skill-manager">
    <Transition name="view-switch" mode="out-in">
      <section v-if="currentView === 'list'" key="list" class="page-shell">
        <section class="toolbar-card">
          <label class="search-field">
            <input v-model="skillKeyword" type="text" placeholder="搜索 skill 名称、描述或来源目录" />
          </label>

          <div ref="directoryFilterRef" class="directory-filter">
            <button class="directory-filter-trigger" type="button" @click="toggleDirectoryMenu">
              <span>{{ selectedDirectoryText }}</span>
              <span class="directory-filter-caret" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M4.47 6.97a.75.75 0 0 1 1.06 0L8 9.44l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
                </svg>
              </span>
            </button>

            <div v-if="isDirectoryMenuOpen" class="directory-filter-menu">
              <label
                v-for="directory in directoryFilterOptions"
                :key="directory.id"
                class="directory-filter-option"
              >
                <input
                  :checked="isDirectorySelected(directory.id)"
                  type="checkbox"
                  @change="toggleDirectorySelection(directory.id)"
                />
                <span>{{ directory.label }}</span>
              </label>
            </div>
          </div>

          <label class="status-field">
            <div class="status-select-wrap">
              <select v-model="statusFilter">
                <option value="all">全部状态</option>
                <option value="enabled">仅启用</option>
                <option value="disabled">仅禁用</option>
              </select>
              <span class="status-select-caret" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M4.47 6.97a.75.75 0 0 1 1.06 0L8 9.44l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
                </svg>
              </span>
            </div>
          </label>

          <button class="button secondary" type="button" @click="refreshSkills" :disabled="isLoading">
            {{ isLoading ? '查询中...' : '查询' }}
          </button>
        </section>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

        <section class="list-card">
          <div class="list-meta">
            <span>已连接目录 {{ healthyDirectoryCount }}/{{ scannedDirectories.length }}</span>
            <span>列表结果 {{ filteredSkills.length }}</span>
          </div>

          <div v-if="!isLoading && filteredSkills.length === 0" class="empty-state">
            <h3>没有可展示的 skill</h3>
            <p>检查设置页里的目录配置，或调整当前筛选条件后再刷新。</p>
          </div>

          <div v-else>
            <article
              v-for="skill in filteredSkills"
              :key="skill.id"
              :class="['skill-row', { disabled: skill.disabled }]"
            >
              <div class="skill-row-top">
                <div class="skill-copy">
                  <button class="skill-name-button" type="button" :title="skill.skillDirPath" @click="openSkillDirectory(skill)">
                    <span class="skill-name">{{ skill.name }}</span>
                  </button>
                  <span class="skill-path">{{ getSkillDisplayPath(skill) }}</span>
                </div>

              <div class="skill-row-actions">
                <button
                  :class="['status-switch', skill.disabled ? 'off' : 'on']"
                  type="button"
                  role="switch"
                  :aria-checked="String(!skill.disabled)"
                  :disabled="isSkillSwitching(skill.id) || isSkillDeleting(skill.id)"
                  @click="toggleSkillDisabled(skill)"
                >
                  <span class="status-switch-track">
                    <span class="status-switch-thumb" />
                  </span>
                  <span class="status-switch-label">{{ skill.disabled ? '禁用' : '启用' }}</span>
                </button>

                <button
                  class="skill-delete-icon-button"
                  type="button"
                  :disabled="isSkillSwitching(skill.id) || isSkillDeleting(skill.id)"
                  :aria-label="`删除 ${skill.name}`"
                  title="删除"
                  @click="removeSkill(skill)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 3.75A2.25 2.25 0 0 1 11.25 1.5h1.5A2.25 2.25 0 0 1 15 3.75V4.5h3.75a.75.75 0 0 1 0 1.5h-1.02l-.84 13.36A2.25 2.25 0 0 1 14.64 21h-5.28a2.25 2.25 0 0 1-2.25-1.64L6.27 6H5.25a.75.75 0 0 1 0-1.5H9v-.75Zm1.5.75h3v-.75a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v.75Zm-2.73 1.5.82 13.12a.75.75 0 0 0 .75.63h5.28a.75.75 0 0 0 .75-.63L16.2 6H7.8Zm2.48 2.25a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm3.5 0A.75.75 0 0 1 14.5 9v7.5a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Z" fill="currentColor" />
                  </svg>
                </button>
              </div>
              </div>

              <div class="skill-row-bottom">
                <div :class="['skill-description-box', { expanded: isSkillDescriptionExpanded(skill.id) }]">
                  <span :ref="setSkillDescriptionMeasureRef(skill.id)" class="skill-description skill-description--measure">
                    {{ skill.description }}
                  </span>
                  <p :class="['skill-description', { expanded: isSkillDescriptionExpanded(skill.id) }]">{{ skill.description }}</p>
                </div>
                <button
                  v-if="shouldShowSkillDescriptionToggle(skill.id)"
                  class="skill-description-toggle"
                  type="button"
                  @click="toggleSkillDescriptionExpansion(skill.id)"
                >
                  {{ isSkillDescriptionExpanded(skill.id) ? '收起' : '查看更多' }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <button class="settings-fab" type="button" @click="openSettings" aria-label="打开设置" title="设置">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.13.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.13-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zm-7.14 2.56A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
              fill="currentColor"
            />
          </svg>
        </button>
      </section>

      <section v-else key="settings" class="page-shell">
        <header class="settings-header">
          <div class="settings-title-row">
            <h2>目录配置</h2>
            <p class="settings-note">修改会自动保存，返回列表时会重新扫描。</p>
          </div>

          <button class="button secondary compact" type="button" @click="refreshSkills" :disabled="isLoading">
            {{ isLoading ? '扫描中...' : '立即扫描' }}
          </button>
        </header>

        <section class="settings-card">
          <div class="settings-actions">
            <button class="button ghost compact" type="button" @click="resetDefaultDirectories">重置默认</button>
          </div>

          <div class="directory-groups">
            <section v-for="section in directorySections" :key="section.key" class="directory-module">
              <header class="directory-module-header">
                <h3>{{ section.title }}</h3>
              </header>

              <div class="directory-list">
                <article v-for="directory in section.items" :key="directory.id" class="directory-item">
                  <div class="directory-row">
                    <span class="directory-name">{{ getDirectoryDisplayLabel(directory) }}</span>
                    <input
                      v-model="directory.path"
                      class="directory-path-input"
                      type="text"
                      placeholder="支持 ~ 和 ${projectRoot}"
                    />
                    <span class="directory-count">
                      {{ getDirectoryScanState(directory.id)?.totalSkills || 0 }} 个 skill
                    </span>
                    <button class="button ghost compact" type="button" @click="browseDirectoryConfig(directory)">选择</button>
                    <div class="directory-side">
                      <button
                        v-if="directory.source === 'custom'"
                        class="button danger compact"
                        type="button"
                        @click="removeDirectoryConfig(directory.id)"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div class="directory-foot">
                    <span class="directory-state">{{ getDirectoryStateText(directory.id) }}</span>
                  </div>
                </article>
              </div>

              <div v-if="section.key === 'project'" class="project-root-row">
                <span class="directory-name">项目根目录</span>
                <input
                  v-model="projectRoot"
                  class="directory-path-input"
                  type="text"
                  placeholder="用于解析 ${projectRoot} 占位符"
                />
                <button class="button secondary compact" type="button" @click="browseProjectRoot">选择</button>
              </div>
            </section>
          </div>
        </section>

        <button class="settings-back-fab" type="button" @click="closeSettings" aria-label="返回列表" title="返回列表">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M14.78 5.22a.75.75 0 0 1 0 1.06L9.06 12l5.72 5.72a.75.75 0 1 1-1.06 1.06l-6.25-6.25a.75.75 0 0 1 0-1.06l6.25-6.25a.75.75 0 0 1 1.06 0Z"
              fill="currentColor"
            />
          </svg>
        </button>
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.toolbar-card,
.list-card,
.settings-header,
.settings-card {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
}

.directory-row,
.skill-row-top,
.skill-row-bottom,
.field-inline,
.settings-actions,
.list-meta,
.settings-header {
  display: flex;
  gap: 10px;
  align-items: center;
}

.settings-header h2,
.empty-state h3,
.skill-name {
  margin: 0;
  font-family: "Avenir Next", "IBM Plex Sans", sans-serif;
  letter-spacing: -0.03em;
}

.list-meta,
.skill-description,
.skill-path,
.directory-state,
.directory-count,
.empty-state p {
  color: var(--text-soft);
}

.toolbar-card,
.settings-card {
  padding: 10px;
}

.toolbar-card {
  position: relative;
  z-index: 5;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content 108px 72px;
  gap: 8px;
  align-items: center;
  overflow: visible;
}

.search-field,
.directory-filter,
.status-field,
.field {
  min-width: 0;
}

.directory-filter {
  position: relative;
  justify-self: start;
}

.directory-filter-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: fit-content;
  min-width: 0;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-strong);
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}

.status-select-wrap {
  position: relative;
}

.status-field select {
  width: 100%;
  min-height: 36px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-strong);
  color: var(--text);
  appearance: none;
}

.directory-filter-caret {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--text-soft);
}

.directory-filter-caret svg,
.status-select-caret svg {
  width: 14px;
  height: 14px;
}

.status-select-caret {
  position: absolute;
  top: 50%;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-soft);
  pointer-events: none;
  transform: translateY(-50%);
}

.directory-filter-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 50;
  display: grid;
  gap: 6px;
  width: max-content;
  min-width: max-content;
  max-width: none;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.directory-filter-action {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--brand);
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.directory-filter-option {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px;
  align-items: start;
  min-width: 0;
  font-size: 12px;
}

.directory-filter-option input {
  margin: 1px 0 0;
}

.directory-filter-option span {
  line-height: 1.35;
  white-space: nowrap;
  word-break: normal;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
}

.list-card,
.settings-card {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.list-card {
  padding: 10px;
}

.list-meta {
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 4px;
  font-size: 12px;
}

.skill-row {
  padding: 8px 10px;
  border-radius: 16px;
  background: var(--surface-strong);
}

.skill-row + .skill-row {
  margin-top: 6px;
}

.skill-row.disabled {
  opacity: 0.78;
}

.skill-row-top {
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.skill-copy {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  flex: 1;
  min-width: 0;
}

.skill-name-button {
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--brand);
  cursor: pointer;
  text-align: left;
}

.skill-name-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--brand) 42%, transparent);
  outline-offset: 2px;
  border-radius: 6px;
}

.skill-name {
  display: block;
  min-width: 0;
  font-size: 16px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-name-button:hover .skill-name {
  text-decoration: underline;
}

.skill-name-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-description {
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-row-bottom {
  justify-content: flex-start;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
}

.status-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.skill-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.status-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 32px;
  height: 18px;
  border-radius: 999px;
  transition: background-color 0.16s ease;
}

.status-switch.on {
  color: #16a34a;
  font-weight: 800;
}

.status-switch.off {
  color: #dc2626;
  font-weight: 800;
}

.status-switch.on .status-switch-track {
  background: rgba(22, 163, 74, 0.5);
}

.status-switch.off .status-switch-track {
  background: rgba(220, 38, 38, 0.5);
}

.status-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24);
  transition: transform 0.16s ease;
}

.status-switch.on .status-switch-thumb {
  transform: translateX(14px);
}

.skill-delete-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 999px;
  color: #dc2626;
  cursor: pointer;
}

.skill-delete-icon-button svg {
  width: 16px;
  height: 16px;
}

.skill-delete-icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.skill-description-box {
  position: relative;
  flex: 0 1 70%;
  min-width: 0;
  max-width: 70%;
}

.skill-description.expanded {
  display: block;
  overflow: visible;
  text-overflow: clip;
  -webkit-line-clamp: unset;
  word-break: break-all;
}

.skill-description--measure {
  position: absolute;
  inset: 0;
  display: block;
  visibility: hidden;
  pointer-events: none;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  word-break: break-all;
}

.skill-description-toggle {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}

.settings-header {
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
}

.settings-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.settings-header h2 {
  font-size: 20px;
}

.settings-note {
  min-width: 0;
  margin: 0;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.settings-actions {
  justify-content: flex-end;
  margin-bottom: 10px;
}

.directory-groups {
  display: grid;
  gap: 14px;
}

.directory-module {
  display: grid;
  gap: 8px;
}

.directory-module-header {
  display: flex;
  align-items: center;
}

.directory-module-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.directory-list {
  display: grid;
  gap: 10px;
}

.directory-item {
  padding: 10px;
  border-radius: 16px;
  background: var(--surface-strong);
}

.directory-row {
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  margin-bottom: 8px;
}

.project-root-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  padding: 10px;
  border-radius: 16px;
  background: var(--surface-strong);
}

.directory-name {
  flex-shrink: 0;
  min-width: 108px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.directory-path-input {
  flex: 0 1 320px;
  min-width: 0;
  max-width: 360px;
}

.directory-side {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.directory-foot {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.directory-state {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-count {
  flex-shrink: 0;
  color: var(--text-soft);
  font-size: 12px;
  white-space: nowrap;
}

.empty-state {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 24px 16px;
  text-align: center;
}

.empty-state p {
  margin: 8px 0 0;
  font-size: 13px;
}

.error-message {
  margin: 0;
  padding: 0 4px;
  color: var(--danger);
  font-size: 12px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease, background-color 0.16s ease;
}

.button.compact {
  min-height: 32px;
  padding: 0 12px;
  font-size: 12px;
}

.button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.button:not(:disabled):hover {
  transform: translateY(-1px);
}

.button.secondary {
  background: rgba(15, 118, 110, 0.12);
  color: var(--brand);
}

.button.ghost {
  background: var(--surface-muted);
  color: var(--text);
}

.button.danger {
  background: rgba(180, 35, 24, 0.12);
  color: var(--danger);
}

.settings-fab {
  position: absolute;
  right: 2px;
  bottom: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.08);
  color: var(--brand);
  box-shadow: 0 8px 18px rgba(15, 118, 110, 0.12);
  cursor: pointer;
}

.settings-fab svg {
  width: 16px;
  height: 16px;
}

.settings-fab:hover {
  transform: translateY(-1px);
}

.settings-back-fab {
  position: absolute;
  right: 2px;
  bottom: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.08);
  color: var(--brand);
  box-shadow: 0 8px 18px rgba(15, 118, 110, 0.12);
  cursor: pointer;
}

.settings-back-fab svg {
  width: 16px;
  height: 16px;
}

.settings-back-fab:hover {
  transform: translateY(-1px);
}

.view-switch-enter-active,
.view-switch-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.view-switch-enter-from,
.view-switch-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 860px) {
  .field-inline,
  .directory-foot {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .settings-actions {
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .directory-side {
    align-self: flex-start;
  }

  .directory-state {
    text-align: left;
    white-space: normal;
  }
}
</style>
