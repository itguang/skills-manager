<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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

const PAGE_SIZE = 10

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
    ...item,
    ...savedById.get(item.id)
  }))

  const customItems = savedItems.filter((item) => !defaultIds.has(item.id))

  return [...mergedDefaults, ...customItems]
}

const projectRoot = ref('')
const directoryConfigs = ref<any[]>([])
const selectedDirectoryIds = ref<string[]>([])
const scannedDirectories = ref<any[]>([])
const skills = ref<any[]>([])
const directorySearch = ref('')
const skillKeyword = ref('')
const statusFilter = ref('all')
const currentPage = ref(1)
const isLoading = ref(false)
const isDirectoryMenuOpen = ref(false)
const errorMessage = ref('')
const dropdownRef = ref<HTMLElement | null>(null)

function persistSettings () {
  setStorageItem(STORAGE_KEYS.projectRoot, projectRoot.value)
  setStorageItem(STORAGE_KEYS.directories, directoryConfigs.value)
  setStorageItem(STORAGE_KEYS.selectedDirectoryIds, selectedDirectoryIds.value)
}

function ensureSelectedDirectories () {
  const existingIds = new Set(directoryConfigs.value.map((item) => item.id))
  const preservedIds = selectedDirectoryIds.value.filter((id) => existingIds.has(id))
  selectedDirectoryIds.value = preservedIds.length > 0
    ? preservedIds
    : directoryConfigs.value.map((item) => item.id)
}

function loadSettings () {
  projectRoot.value = getStorageItem(STORAGE_KEYS.projectRoot, '')
  directoryConfigs.value = mergeDirectoryConfigs(getStorageItem(STORAGE_KEYS.directories, DEFAULT_DIRECTORY_CONFIGS))
  selectedDirectoryIds.value = getStorageItem(
    STORAGE_KEYS.selectedDirectoryIds,
    directoryConfigs.value.map((item) => item.id)
  )
  ensureSelectedDirectories()
}

function showNotification (message: string) {
  window.utools.showNotification(message)
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
    ensureSelectedDirectories()
    persistSettings()
  } catch (error: any) {
    errorMessage.value = error?.message || '读取 skill 目录失败'
  } finally {
    isLoading.value = false
  }
}

function saveConfigAndRefresh () {
  ensureSelectedDirectories()
  persistSettings()
  refreshSkills()
}

function resetDefaultDirectories () {
  directoryConfigs.value = DEFAULT_DIRECTORY_CONFIGS.map((item) => ({ ...item }))
  selectedDirectoryIds.value = directoryConfigs.value.map((item) => item.id)
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

function addCustomDirectory () {
  const directories = window.utools.showOpenDialog({
    title: '选择要管理的 skill 目录',
    properties: ['openDirectory']
  })

  if (!directories || directories.length === 0) return

  const selectedPath = directories[0]
  const nextConfig = {
    id: `custom-${Date.now()}`,
    label: selectedPath.split('/').filter(Boolean).at(-1) || '自定义目录',
    path: selectedPath,
    source: 'custom'
  }

  directoryConfigs.value = [...directoryConfigs.value, nextConfig]
  selectedDirectoryIds.value = [...selectedDirectoryIds.value, nextConfig.id]
  persistSettings()
  refreshSkills()
}

function removeDirectoryConfig (directoryId: string) {
  directoryConfigs.value = directoryConfigs.value.filter((item) => item.id !== directoryId)
  selectedDirectoryIds.value = selectedDirectoryIds.value.filter((id) => id !== directoryId)
  ensureSelectedDirectories()
  persistSettings()
  refreshSkills()
}

function toggleDirectorySelection (directoryId: string) {
  const selectedIds = new Set(selectedDirectoryIds.value)

  if (selectedIds.has(directoryId)) {
    selectedIds.delete(directoryId)
  } else {
    selectedIds.add(directoryId)
  }

  selectedDirectoryIds.value = [...selectedIds]
  persistSettings()
}

function closeDirectoryMenuOnOutsideClick (event: MouseEvent) {
  const dropdownElement = dropdownRef.value
  if (!dropdownElement) return
  if (dropdownElement.contains(event.target as Node)) return
  isDirectoryMenuOpen.value = false
}

async function toggleSkillDisabled (skill: any) {
  try {
    window.services.setSkillDisabled({
      skillDirPath: skill.skillDirPath,
      disabled: !skill.disabled
    })

    await refreshSkills()
    showNotification(skill.disabled ? `已启用 ${skill.name}` : `已禁用 ${skill.name}`)
  } catch (error: any) {
    showNotification(error?.message || '切换 skill 状态失败')
  }
}

async function deleteSkill (skill: any) {
  const confirmed = window.confirm(`确认删除 skill "${skill.name}" 吗？这会删除整个 skill 目录。`)
  if (!confirmed) return

  try {
    window.services.removeSkill({
      skillDirPath: skill.skillDirPath
    })

    await refreshSkills()
    showNotification(`已删除 ${skill.name}`)
  } catch (error: any) {
    showNotification(error?.message || '删除 skill 失败')
  }
}

const selectedDirectoryText = computed(() => {
  if (selectedDirectoryIds.value.length === 0) return '未选择目录'
  if (selectedDirectoryIds.value.length === directoryConfigs.value.length) {
    return `全部目录 (${directoryConfigs.value.length})`
  }
  return `已选目录 (${selectedDirectoryIds.value.length})`
})

const visibleDirectoryOptions = computed(() => {
  const keyword = directorySearch.value.trim().toLowerCase()

  return scannedDirectories.value.filter((directory) => {
    if (!keyword) return true
    return `${directory.label} ${directory.path} ${directory.resolvedPath}`.toLowerCase().includes(keyword)
  })
})

const filteredSkills = computed(() => {
  const keyword = skillKeyword.value.trim().toLowerCase()
  const selectedIds = new Set(selectedDirectoryIds.value)

  return skills.value.filter((skill) => {
    if (selectedIds.size > 0 && !selectedIds.has(skill.directoryId)) return false
    if (statusFilter.value === 'enabled' && skill.disabled) return false
    if (statusFilter.value === 'disabled' && !skill.disabled) return false
    if (keyword && !skill.name.toLowerCase().includes(keyword)) return false
    return true
  })
})

const totalPages = computed(() => {
  const pages = Math.ceil(filteredSkills.value.length / PAGE_SIZE)
  return pages > 0 ? pages : 1
})

const pagedSkills = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredSkills.value.slice(start, start + PAGE_SIZE)
})

const enabledSkillCount = computed(() => skills.value.filter((skill) => !skill.disabled).length)
const disabledSkillCount = computed(() => skills.value.filter((skill) => skill.disabled).length)

watch(() => props.enterAction, () => {
  window.utools.setExpendHeight(720)
}, { immediate: true })

watch([skillKeyword, statusFilter, selectedDirectoryIds], () => {
  currentPage.value = 1
})

watch(filteredSkills, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

onMounted(() => {
  document.addEventListener('click', closeDirectoryMenuOnOutsideClick)
  loadSettings()
  refreshSkills()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDirectoryMenuOnOutsideClick)
})
</script>

<template>
  <div class="skill-manager">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Local Skill Registry</p>
        <h1>Skills Manager</h1>
        <p class="hero-text">
          统一管理当前机器上的 skill 目录。支持目录配置、多选查看、关键词检索、分页，以及删除与禁用。
        </p>
      </div>
      <div class="hero-stats">
        <article class="stat-card">
          <span class="stat-label">总技能数</span>
          <strong class="stat-value">{{ skills.length }}</strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">已启用</span>
          <strong class="stat-value">{{ enabledSkillCount }}</strong>
        </article>
        <article class="stat-card">
          <span class="stat-label">已禁用</span>
          <strong class="stat-value">{{ disabledSkillCount }}</strong>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>目录配置</h2>
          <p>默认预置 OpenCode、Claude 兼容和 Agents 兼容目录，也支持继续添加自定义目录。</p>
        </div>
        <div class="panel-actions">
          <button class="button ghost" type="button" @click="addCustomDirectory">添加自定义目录</button>
          <button class="button ghost" type="button" @click="resetDefaultDirectories">重置默认目录</button>
          <button class="button primary" type="button" @click="saveConfigAndRefresh" :disabled="isLoading">
            保存并刷新
          </button>
        </div>
      </div>

      <div class="project-root-row">
        <label class="field">
          <span class="field-label">项目根目录</span>
          <input v-model="projectRoot" type="text" placeholder="为项目级目录配置一个根路径，例如 /Users/name/project" />
        </label>
        <button class="button secondary" type="button" @click="browseProjectRoot">选择目录</button>
      </div>

      <div class="directory-configs">
        <article v-for="directory in directoryConfigs" :key="directory.id" class="directory-card">
          <label class="field">
            <span class="field-label">目录名称</span>
            <input v-model="directory.label" type="text" placeholder="目录名称" />
          </label>
          <label class="field path-field">
            <span class="field-label">目录路径</span>
            <input v-model="directory.path" type="text" placeholder="支持 ~ 和 ${projectRoot}" />
          </label>
          <button
            v-if="directory.source === 'custom'"
            class="icon-button"
            type="button"
            @click="removeDirectoryConfig(directory.id)"
          >
            删除
          </button>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>筛选与检索</h2>
          <p>目录可多选，列表只显示 skill name 和 description，并保留禁用状态筛选。</p>
        </div>
        <button class="button secondary" type="button" @click="refreshSkills" :disabled="isLoading">
          {{ isLoading ? '刷新中...' : '刷新列表' }}
        </button>
      </div>

      <div class="filters">
        <div class="directory-picker" ref="dropdownRef">
          <button class="picker-trigger" type="button" @click.stop="isDirectoryMenuOpen = !isDirectoryMenuOpen">
            <span>{{ selectedDirectoryText }}</span>
            <span class="picker-caret">{{ isDirectoryMenuOpen ? '▲' : '▼' }}</span>
          </button>

          <div v-if="isDirectoryMenuOpen" class="picker-dropdown">
            <input v-model="directorySearch" type="text" placeholder="搜索目录名称或路径" />
            <div class="picker-options">
              <label v-for="directory in visibleDirectoryOptions" :key="directory.id" class="picker-option">
                <input
                  :checked="selectedDirectoryIds.includes(directory.id)"
                  type="checkbox"
                  @change="toggleDirectorySelection(directory.id)"
                />
                <div class="picker-content">
                  <div class="picker-topline">
                    <strong>{{ directory.label }}</strong>
                    <span>{{ directory.totalSkills }} 个</span>
                  </div>
                  <div class="picker-path">{{ directory.resolvedPath || directory.path }}</div>
                  <div v-if="directory.reason" class="picker-note">{{ directory.reason }}</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <label class="field">
          <span class="field-label">Skill Name 检索</span>
          <input v-model="skillKeyword" type="text" placeholder="按 skill name 关键字过滤" />
        </label>

        <label class="field status-field">
          <span class="field-label">状态</span>
          <select v-model="statusFilter">
            <option value="all">全部</option>
            <option value="enabled">仅启用</option>
            <option value="disabled">仅禁用</option>
          </select>
        </label>
      </div>

      <div class="summary-bar">
        <span>已选目录 {{ selectedDirectoryIds.length }} 个</span>
        <span>筛选结果 {{ filteredSkills.length }} 个</span>
        <span>共 {{ skills.length }} 个 skill</span>
      </div>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </section>

    <section class="list-section">
      <article v-for="skill in pagedSkills" :key="skill.id" :class="['skill-card', { disabled: skill.disabled }]">
        <div class="skill-header">
          <div>
            <h3>{{ skill.name }}</h3>
            <p class="skill-description">{{ skill.description }}</p>
          </div>
          <span :class="['status-badge', skill.disabled ? 'disabled' : 'enabled']">
            {{ skill.disabled ? '已禁用' : '已启用' }}
          </span>
        </div>

        <div class="skill-footer">
          <span class="skill-location">{{ skill.directoryLabel }}</span>
          <div class="skill-actions">
            <button class="button ghost" type="button" @click="toggleSkillDisabled(skill)">
              {{ skill.disabled ? '启用' : '禁用' }}
            </button>
            <button class="button danger" type="button" @click="deleteSkill(skill)">删除</button>
          </div>
        </div>
      </article>

      <div v-if="!isLoading && pagedSkills.length === 0" class="empty-state">
        <h3>没有匹配的 skill</h3>
        <p>检查目录配置、项目根目录或筛选条件后再刷新列表。</p>
      </div>
    </section>

    <section class="pagination-bar">
      <div>第 {{ currentPage }} / {{ totalPages }} 页</div>
      <div class="pagination-actions">
        <button class="button ghost" type="button" :disabled="currentPage === 1" @click="currentPage -= 1">上一页</button>
        <button class="button ghost" type="button" :disabled="currentPage === totalPages" @click="currentPage += 1">下一页</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.skill-manager {
  min-height: 100vh;
  padding: 28px;
  color: var(--text);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.hero-copy,
.hero-stats,
.panel,
.list-section,
.pagination-bar {
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--surface);
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
}

.hero-copy {
  padding: 28px;
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--brand);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-copy h1,
.panel-header h2,
.empty-state h3 {
  margin: 0;
  font-family: "Avenir Next", "IBM Plex Sans", sans-serif;
  letter-spacing: -0.03em;
}

.hero-copy h1 {
  font-size: 38px;
}

.hero-text,
.panel-header p,
.picker-path,
.picker-note,
.summary-bar,
.skill-description,
.skill-location,
.empty-state p {
  color: var(--text-soft);
}

.hero-text {
  margin: 12px 0 0;
  max-width: 720px;
  line-height: 1.6;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 112px;
  padding: 18px;
  border-radius: 20px;
  background: var(--surface-strong);
}

.stat-label {
  color: var(--text-soft);
  font-size: 13px;
}

.stat-value {
  font-size: 34px;
  line-height: 1;
}

.panel,
.pagination-bar {
  margin-bottom: 18px;
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.panel-header p {
  margin: 6px 0 0;
  line-height: 1.5;
}

.panel-actions,
.project-root-row,
.filters,
.summary-bar,
.skill-footer,
.pagination-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.panel-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.project-root-row {
  margin-bottom: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
}

.directory-configs {
  display: grid;
  gap: 12px;
}

.directory-card {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  padding: 14px;
  border-radius: 18px;
  background: var(--surface-strong);
}

.path-field {
  min-width: 0;
}

.filters {
  align-items: end;
}

.directory-picker {
  position: relative;
  width: min(360px, 100%);
}

.picker-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 50px;
  padding: 0 16px;
  border-radius: 14px;
  background: var(--surface-strong);
  color: var(--text);
  cursor: pointer;
}

.picker-caret {
  color: var(--text-soft);
  font-size: 12px;
}

.picker-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: 10;
  width: 100%;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface-strong);
  box-shadow: var(--shadow);
}

.picker-options {
  display: grid;
  gap: 10px;
  max-height: 260px;
  margin-top: 12px;
  overflow: auto;
}

.picker-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 10px 12px;
  border-radius: 16px;
  background: var(--surface-muted);
}

.picker-option input {
  width: 16px;
  height: 16px;
  margin-top: 4px;
}

.picker-content {
  min-width: 0;
}

.picker-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.picker-path,
.picker-note {
  margin-top: 4px;
  font-size: 12px;
  word-break: break-all;
}

.status-field {
  max-width: 180px;
}

.summary-bar {
  flex-wrap: wrap;
  padding: 14px 16px;
  margin-top: 16px;
  border-radius: 18px;
  background: var(--surface-muted);
}

.error-message {
  margin: 16px 0 0;
  color: var(--danger);
}

.list-section {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.skill-card {
  padding: 18px;
  border-radius: 20px;
  background: var(--surface-strong);
  transition: transform 0.16s ease, border-color 0.16s ease;
}

.skill-card.disabled {
  opacity: 0.82;
}

.skill-card:hover {
  transform: translateY(-1px);
}

.skill-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.skill-header h3 {
  margin: 0;
  font-size: 20px;
}

.skill-description {
  margin: 10px 0 0;
  line-height: 1.6;
}

.status-badge {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-badge.enabled {
  background: rgba(15, 118, 110, 0.12);
  color: var(--brand);
}

.status-badge.disabled {
  background: rgba(180, 35, 24, 0.12);
  color: var(--danger);
}

.skill-footer {
  justify-content: space-between;
  margin-top: 16px;
}

.skill-location {
  font-size: 13px;
}

.skill-actions {
  display: flex;
  gap: 10px;
}

.empty-state {
  padding: 32px 20px;
  text-align: center;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.button,
.icon-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease, background-color 0.16s ease;
}

.button:disabled,
.icon-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.button:not(:disabled):hover,
.icon-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.button.primary {
  background: var(--brand);
  color: #f5fffd;
}

.button.secondary {
  background: rgba(15, 118, 110, 0.1);
  color: var(--brand);
}

.button.ghost,
.icon-button {
  background: var(--surface-muted);
  color: var(--text);
}

.button.danger {
  background: rgba(180, 35, 24, 0.12);
  color: var(--danger);
}

@media (max-width: 960px) {
  .skill-manager {
    padding: 18px;
  }

  .hero,
  .directory-card,
  .filters,
  .panel-header,
  .project-root-row,
  .skill-footer,
  .pagination-bar {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }

  .directory-picker,
  .status-field {
    max-width: none;
    width: 100%;
  }

  .skill-header {
    flex-direction: column;
  }

  .skill-actions,
  .panel-actions,
  .pagination-actions {
    width: 100%;
  }

  .skill-actions .button,
  .panel-actions .button,
  .pagination-actions .button,
  .project-root-row .button {
    width: 100%;
  }
}
</style>
