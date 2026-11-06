import { computed, ref, watch } from 'vue'
import { AGENT_PRESETS, CUSTOM_AGENT_ID, SHARED_AGENT_ID } from './agents'
import { createId, getBaseName } from './utils'
import type { ScanSource } from './types'

export interface AgentSourceSetting {
  enabled: boolean
  globalPath: string
  projectPath: string
  // 是否读取「全局」目录（~/.agents/skills），决定全局 skill 会不会显示为该 agent 可用
  readsShared: boolean
}

export interface CustomSource {
  id: string
  label: string
  path: string
  agentId: string
}

export interface ProjectEntry {
  id: string
  name: string
  path: string
}

export interface SkillManagerSettings {
  agents: Record<string, AgentSourceSetting>
  customSources: CustomSource[]
  projects: ProjectEntry[]
  activeProjectId: string
}

const SETTINGS_KEY = 'skills-manager.settings.v2'
const LEGACY_DIRECTORIES_KEY = 'skills-manager.directories'
const LEGACY_PROJECT_ROOT_KEY = 'skills-manager.projectRoot'

// v1 版本只有全局目录允许编辑，这里记录它们的旧 id 与旧默认值，用于判断用户是否改过
const LEGACY_GLOBAL_DIRECTORIES: Record<string, { agentId: string, defaultPath: string }> = {
  'preset-agents-global': { agentId: 'agents', defaultPath: '~/.agents/skills' },
  'preset-claude-global': { agentId: 'claude', defaultPath: '~/.claude/skills' },
  'preset-codex-global': { agentId: 'codex', defaultPath: '~/.codex/skills' },
  'preset-opencode-global': { agentId: 'opencode', defaultPath: '~/.config/opencode/skills' }
}

function readStorage (key: string) {
  try {
    return window.utools.dbStorage.getItem(key) ?? null
  } catch (error) {
    return null
  }
}

function writeStorage (key: string, value: unknown) {
  // dbStorage 只能存可序列化的纯对象，先去掉 Vue 的响应式代理
  window.utools.dbStorage.setItem(key, JSON.parse(JSON.stringify(value)))
}

function createDefaultAgentSettings () {
  const agents: Record<string, AgentSourceSetting> = {}
  for (const preset of AGENT_PRESETS) {
    agents[preset.id] = {
      enabled: true,
      globalPath: preset.globalPath,
      projectPath: preset.projectPath,
      readsShared: preset.readsSharedByDefault
    }
  }
  return agents
}

function createDefaultSettings (): SkillManagerSettings {
  return {
    agents: createDefaultAgentSettings(),
    customSources: [],
    projects: [],
    activeProjectId: ''
  }
}

function createProjectEntry (projectPath: string): ProjectEntry {
  return { id: createId('project'), name: getBaseName(projectPath), path: projectPath }
}

// 以默认值为底合并已保存的配置，保证以后新增的 agent 预设也能出现在老用户的配置里
function normalizeSettings (saved: any): SkillManagerSettings {
  const settings = createDefaultSettings()
  const savedAgents = saved?.agents && typeof saved.agents === 'object' ? saved.agents : {}

  for (const preset of AGENT_PRESETS) {
    const savedAgent = savedAgents[preset.id]
    if (!savedAgent) continue
    settings.agents[preset.id] = {
      enabled: savedAgent.enabled !== false,
      globalPath: typeof savedAgent.globalPath === 'string' ? savedAgent.globalPath : preset.globalPath,
      projectPath: typeof savedAgent.projectPath === 'string' ? savedAgent.projectPath : preset.projectPath,
      readsShared: typeof savedAgent.readsShared === 'boolean' ? savedAgent.readsShared : preset.readsSharedByDefault
    }
  }

  settings.customSources = Array.isArray(saved?.customSources)
    ? saved.customSources.filter((item: any) => item && typeof item.id === 'string')
    : []
  settings.projects = Array.isArray(saved?.projects)
    ? saved.projects.filter((item: any) => item && typeof item.id === 'string' && typeof item.path === 'string')
    : []

  const activeProjectExists = settings.projects.some((project) => project.id === saved?.activeProjectId)
  settings.activeProjectId = activeProjectExists ? saved.activeProjectId : ''

  return settings
}

function migrateLegacySettings (): SkillManagerSettings {
  const settings = createDefaultSettings()

  const legacyProjectRoot = readStorage(LEGACY_PROJECT_ROOT_KEY)
  if (typeof legacyProjectRoot === 'string' && legacyProjectRoot.trim()) {
    const project = createProjectEntry(legacyProjectRoot.trim())
    settings.projects.push(project)
    settings.activeProjectId = project.id
  }

  const legacyDirectories = readStorage(LEGACY_DIRECTORIES_KEY)
  for (const directory of Array.isArray(legacyDirectories) ? legacyDirectories : []) {
    const legacyGlobal = LEGACY_GLOBAL_DIRECTORIES[directory?.id]
    const legacyPath = typeof directory?.path === 'string' ? directory.path.trim() : ''
    if (!legacyGlobal || !legacyPath || legacyPath === legacyGlobal.defaultPath) continue
    settings.agents[legacyGlobal.agentId].globalPath = legacyPath
  }

  return settings
}

function loadSettings () {
  const saved = readStorage(SETTINGS_KEY)
  if (saved) return normalizeSettings(saved)

  // 迁移结果立即落盘，否则每次打开都会重新迁移并生成新的项目 id
  const migratedSettings = migrateLegacySettings()
  try {
    writeStorage(SETTINGS_KEY, migratedSettings)
  } catch (error) {
    window.utools.showNotification('保存配置失败')
  }
  return migratedSettings
}

function buildScanSources (settings: SkillManagerSettings): ScanSource[] {
  const sources: ScanSource[] = []

  for (const preset of AGENT_PRESETS) {
    const agentSetting = settings.agents[preset.id]
    if (!agentSetting?.enabled) continue

    sources.push({ id: `${preset.id}:global`, agentId: preset.id, scope: 'global', path: agentSetting.globalPath })
    sources.push({ id: `${preset.id}:project`, agentId: preset.id, scope: 'project', path: agentSetting.projectPath })
  }

  for (const customSource of settings.customSources) {
    sources.push({
      id: customSource.id,
      agentId: customSource.agentId || CUSTOM_AGENT_ID,
      scope: 'custom',
      label: customSource.label,
      path: customSource.path
    })
  }

  return sources
}

function createSettingsStore () {
  const settings = ref<SkillManagerSettings>(loadSettings())

  const activeProject = computed(() =>
    settings.value.projects.find((project) => project.id === settings.value.activeProjectId) || null
  )
  const scanSources = computed(() => buildScanSources(settings.value))

  // 会读取全局目录的 agent：全局目录里的 skill 对它们同样可用
  const sharedReaderIds = computed(() => AGENT_PRESETS
    .filter((preset) => preset.id !== SHARED_AGENT_ID)
    .filter((preset) => settings.value.agents[preset.id]?.enabled && settings.value.agents[preset.id]?.readsShared)
    .map((preset) => preset.id))

  watch(settings, (value) => {
    try {
      writeStorage(SETTINGS_KEY, value)
    } catch (error) {
      window.utools.showNotification('保存配置失败')
    }
  }, { deep: true })

  function addProject (projectPath: string) {
    const existingProject = settings.value.projects.find((project) => project.path === projectPath)
    const project = existingProject || createProjectEntry(projectPath)
    if (!existingProject) settings.value.projects.push(project)
    settings.value.activeProjectId = project.id
  }

  function removeProject (projectId: string) {
    settings.value.projects = settings.value.projects.filter((project) => project.id !== projectId)
    if (settings.value.activeProjectId === projectId) {
      settings.value.activeProjectId = settings.value.projects[0]?.id || ''
    }
  }

  function addCustomSource (sourcePath: string) {
    settings.value.customSources.push({
      id: createId('custom'),
      label: getBaseName(sourcePath),
      path: sourcePath,
      agentId: ''
    })
  }

  function removeCustomSource (sourceId: string) {
    settings.value.customSources = settings.value.customSources.filter((source) => source.id !== sourceId)
  }

  // 只恢复路径，不改动用户的启用开关和「读取全局目录」选择
  function resetAgentDefaults () {
    for (const preset of AGENT_PRESETS) {
      const agentSetting = settings.value.agents[preset.id]
      agentSetting.globalPath = preset.globalPath
      agentSetting.projectPath = preset.projectPath
    }
  }

  return {
    settings,
    activeProject,
    scanSources,
    sharedReaderIds,
    addProject,
    removeProject,
    addCustomSource,
    removeCustomSource,
    resetAgentDefaults
  }
}

let settingsStore: ReturnType<typeof createSettingsStore> | null = null

// 列表页和设置页共用同一份配置，第一次调用时才读取 dbStorage
export function useSettings () {
  if (!settingsStore) settingsStore = createSettingsStore()
  return settingsStore
}
