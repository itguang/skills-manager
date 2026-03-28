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

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'enabled', label: '仅启用' },
  { value: 'disabled', label: '仅禁用' }
]

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
const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const selectedDirectoryIds = ref<string[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const skillSwitchingIds = ref<string[]>([])
const skillDeletingIds = ref<string[]>([])
const expandedSkillDescriptionIds = ref<string[]>([])
const overflowingSkillDescriptionIds = ref<string[]>([])
const skillDescriptionMeasureElements = new Map<string, HTMLElement>()
const homeDirectory = ref('')

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

const directorySummaryText = computed(() => {
  if (directoryFilterOptions.value.length === 0) return '未发现可筛选目录'
  if (selectedDirectoryIds.value.length === directoryFilterOptions.value.length) {
    return `目录范围：全部 ${directoryFilterOptions.value.length} 个`
  }
  if (selectedDirectoryIds.value.length === 0) return '目录范围：未选择'
  return `目录范围：已选 ${selectedDirectoryIds.value.length} 个`
})

const enabledSkillCount = computed(() => filteredSkills.value.filter((skill) => !skill.disabled).length)
const disabledSkillCount = computed(() => filteredSkills.value.filter((skill) => skill.disabled).length)

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
          <div class="hero-toolbar-top">
            <div class="page-copy page-copy--compact">
              <div class="hero-title-row">
                <span class="page-kicker">本地 skills</span>
                <h1>Skill 管理</h1>
                <p>支持名称、描述、目录路径联合检索</p>
              </div>
            </div>

            <div class="stats-strip stats-strip--compact">
              <article class="stat-chip">
                <span class="stat-chip-label">已连接目录</span>
                <strong>{{ healthyDirectoryCount }}/{{ scannedDirectories.length }}</strong>
              </article>
              <article class="stat-chip">
                <span class="stat-chip-label">列表结果</span>
                <strong>{{ filteredSkills.length }}</strong>
              </article>
              <article class="stat-chip">
                <span class="stat-chip-label">启用</span>
                <strong>{{ enabledSkillCount }}</strong>
              </article>
              <article class="stat-chip">
                <span class="stat-chip-label">禁用</span>
                <strong>{{ disabledSkillCount }}</strong>
              </article>
            </div>

            <div class="page-actions page-actions--compact">
              <el-button plain @click="openSettings">目录配置</el-button>
              <el-button :loading="isLoading" type="primary" @click="refreshSkills">查询</el-button>
            </div>
          </div>

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
              collapse-tags
              collapse-tags-tooltip
              clearable
              multiple
              placeholder="筛选目录"
            >
              <el-option
                v-for="directory in directoryFilterOptions"
                :key="directory.id"
                :label="directory.label"
                :value="directory.id"
              />
            </el-select>

            <el-select v-model="statusFilter" class="toolbar-status">
              <el-option
                v-for="option in STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>

            <div class="toolbar-summary">
              <span>{{ directorySummaryText }}</span>
              <span>联合检索</span>
            </div>
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
            <div class="list-heading">
              <h2>Skills 列表</h2>
              <p>点击名称打开目录，右侧可快速启停和删除。</p>
            </div>

            <div class="list-stats">
              <el-tag effect="plain">已连接目录 {{ healthyDirectoryCount }}/{{ scannedDirectories.length }}</el-tag>
              <el-tag effect="plain" type="success">列表结果 {{ filteredSkills.length }}</el-tag>
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
                      <el-button
                        class="skill-open-button"
                        :title="skill.skillDirPath"
                        link
                        type="primary"
                        @click="openSkillDirectory(skill)"
                      >
                        <span class="skill-name">{{ skill.name }}</span>
                      </el-button>
                      <el-tag effect="light" size="small" :type="skill.disabled ? 'danger' : 'success'">
                        {{ skill.disabled ? '禁用' : '启用' }}
                      </el-tag>
                    </div>

                    <div class="skill-meta-row">
                      <el-tag effect="plain" size="small">{{ skill.directoryLabel || '未知目录' }}</el-tag>
                      <span class="skill-path" :title="getSkillDisplayPath(skill)">{{ getSkillDisplayPath(skill) }}</span>
                    </div>
                  </div>

                  <div class="skill-actions">
                    <el-switch
                      :disabled="isSkillDeleting(skill.id)"
                      :loading="isSkillSwitching(skill.id)"
                      :model-value="!skill.disabled"
                      active-text="启"
                      inactive-text="停"
                      inline-prompt
                      @change="toggleSkillDisabled(skill)"
                    />

                    <el-button
                      :disabled="isSkillSwitching(skill.id) || isSkillDeleting(skill.id)"
                      :loading="isSkillDeleting(skill.id)"
                      plain
                      type="danger"
                      @click="removeSkill(skill)"
                    >
                      删除
                    </el-button>
                  </div>
                </div>

                <div class="skill-bottom">
                  <div class="skill-description-box">
                    <span
                      :ref="setSkillDescriptionMeasureRef(skill.id)"
                      class="skill-description skill-description--measure"
                    >
                      {{ skill.description }}
                    </span>

                    <p :class="['skill-description', { expanded: isSkillDescriptionExpanded(skill.id) }]">
                      {{ skill.description || '暂无说明' }}
                    </p>
                  </div>

                  <el-button
                    v-if="shouldShowSkillDescriptionToggle(skill.id)"
                    link
                    type="primary"
                    @click="toggleSkillDescriptionExpansion(skill.id)"
                  >
                    {{ isSkillDescriptionExpanded(skill.id) ? '收起' : '查看更多' }}
                  </el-button>
                </div>
              </el-card>
            </div>
          </el-scrollbar>
        </section>
      </section>

      <section v-else key="settings" class="page-shell">
        <section class="settings-topbar panel-surface panel-animated">
          <div class="settings-copy">
            <span class="page-kicker">目录维护</span>
            <h2>目录配置</h2>
            <p>修改会自动保存，返回列表时会重新扫描。</p>
          </div>

          <div class="settings-actions">
            <el-button plain @click="resetDefaultDirectories">重置默认</el-button>
            <el-button :loading="isLoading" type="primary" @click="refreshSkills">立即扫描</el-button>
            <el-button @click="closeSettings">返回列表</el-button>
          </div>
        </section>

        <section class="settings-panel panel-surface panel-animated">
          <el-scrollbar class="settings-scrollbar">
            <div class="settings-layout">
              <section class="settings-summary-card">
                <div class="settings-summary-header">
                  <div>
                    <h3>扫描范围</h3>
                    <p>路径支持 `~` 和 `${projectRoot}` 占位符。</p>
                  </div>
                  <el-tag effect="plain">{{ directoryConfigs.length }} 个目录</el-tag>
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

              <section class="project-root-panel">
                <div class="project-root-copy">
                  <div>
                    <h3>项目根目录</h3>
                    <p>用于解析 ${projectRoot} 占位符</p>
                  </div>
                  <el-button type="primary" plain @click="browseProjectRoot">选择</el-button>
                </div>

                <el-input
                  v-model="projectRoot"
                  placeholder="用于解析 ${projectRoot} 占位符"
                />
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
                      <p>路径支持 `~` 和 `${projectRoot}` 占位符。</p>
                    </div>
                    <el-tag effect="plain" size="small">{{ section.items.length }} 个目录</el-tag>
                  </div>

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

                        <div class="directory-card-actions">
                          <el-button plain @click="browseDirectoryConfig(directory)">选择</el-button>
                          <el-button
                            v-if="directory.source === 'custom'"
                            plain
                            type="danger"
                            @click="removeDirectoryConfig(directory.id)"
                          >
                            删除
                          </el-button>
                        </div>
                      </div>

                      <el-input
                        v-model="directory.path"
                        placeholder="支持 ~ 和 ${projectRoot}"
                      />

                      <p class="directory-state">
                        {{ getDirectoryStateText(directory.id) || '项目路径未启用，设置项目根目录后自动生效' }}
                      </p>
                    </el-card>
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
  overflow: hidden;
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
.list-header,
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
.toolbar-summary,
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
.stats-strip,
.list-stats,
.skill-actions,
.directory-card-actions,
.settings-actions,
.settings-summary-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.page-actions--compact {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.stats-strip {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.stats-strip--compact {
  flex: 1;
  justify-content: flex-end;
}

.stat-chip,
.summary-metric {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.48);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.58);
}

.stat-chip {
  flex: 0 1 auto;
}

.stat-chip-label,
.summary-metric span {
  display: block;
  color: var(--text-soft);
  font-size: 11px;
  line-height: 1.2;
}

.stat-chip strong,
.summary-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  line-height: 1;
  letter-spacing: -0.05em;
}

.hero-toolbar-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(200px, 1fr) 130px minmax(180px, auto);
  gap: 10px;
  align-items: center;
  position: relative;
  z-index: 1;
  margin-top: 10px;
}

.toolbar-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  white-space: nowrap;
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
}

.list-header {
  align-items: flex-end;
}

.list-stats {
  justify-content: flex-end;
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
.directory-list {
  display: grid;
  gap: 10px;
}

.skills-list {
  padding-right: 2px;
}

.settings-layout {
  gap: 14px;
  padding-right: 2px;
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
}

.skill-card.is-disabled {
  opacity: 0.82;
}

.skill-card :deep(.el-card__body),
.directory-card :deep(.el-card__body) {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
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

.directory-list {
  margin-top: 12px;
}

.directory-card {
  animation: item-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--item-index, 0) * 0.03s);
}

.skill-title-row,
.directory-card-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.skill-meta-row {
  flex-wrap: wrap;
  justify-content: flex-start;
}

.skill-open-button {
  padding: 0;
}

.skill-name {
  display: block;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-path {
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-actions {
  flex-shrink: 0;
}

.skill-bottom {
  justify-content: flex-start;
  align-items: flex-start;
}

.skill-description-box {
  position: relative;
  flex: 1;
  min-width: 0;
}

.skill-description {
  margin: 0;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.skill-description.expanded {
  display: block;
  overflow: visible;
  text-overflow: clip;
  -webkit-line-clamp: unset;
}

.skill-description--measure {
  position: absolute;
  inset: 0;
  display: block;
  visibility: hidden;
  pointer-events: none;
  overflow: visible;
  text-overflow: clip;
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
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .toolbar-summary,
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
  .stats-strip--compact,
  .list-stats,
  .settings-actions,
  .directory-card-actions,
  .skill-actions {
    justify-content: flex-start;
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

  .stats-strip,
  .settings-summary-grid {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
