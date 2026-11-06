import claudeIcon from './assets/agent-icons/claude.svg'
import codexIcon from './assets/agent-icons/codex.svg'
import copilotIcon from './assets/agent-icons/copilot.svg'
import cursorIcon from './assets/agent-icons/cursor.svg'
import geminiIcon from './assets/agent-icons/gemini.svg'
import opencodeIcon from './assets/agent-icons/opencode.svg'

export interface AgentIcon {
  url: string
  // 单色图标没有自带颜色，需要跟随文字颜色着色，才能在暗色模式下看清
  monochrome: boolean
}

export interface AgentPreset {
  id: string
  name: string
  shortName: string
  // 没有图标时（例如「全局」）用的缩写
  monogram: string
  icon: AgentIcon | null
  globalPath: string
  projectPath: string
  // 是否默认读取 Agent Skills 规范的全局目录（~/.agents/skills 与项目内 .agents/skills）
  readsSharedByDefault: boolean
}

// Agent Skills 规范的共享目录，所有支持该规范的 agent 都会读取，界面上称为「全局」
export const SHARED_AGENT_ID = 'agents'

export const AGENT_PRESETS: AgentPreset[] = [
  { id: SHARED_AGENT_ID, name: '全局', shortName: '全局', monogram: '全', icon: null, globalPath: '~/.agents/skills', projectPath: '.agents/skills', readsSharedByDefault: false },
  // Claude Code 只读取 .claude/skills，需要软链接才能用到全局目录里的 skill
  { id: 'claude', name: 'Claude Code', shortName: 'Claude', monogram: 'Cl', globalPath: '~/.claude/skills', projectPath: '.claude/skills', icon: { url: claudeIcon, monochrome: false }, readsSharedByDefault: false },
  { id: 'codex', name: 'Codex', shortName: 'Codex', monogram: 'Cx', globalPath: '${CODEX_HOME}/skills', projectPath: '.codex/skills', icon: { url: codexIcon, monochrome: false }, readsSharedByDefault: true },
  { id: 'opencode', name: 'OpenCode', shortName: 'OpenCode', monogram: 'Oc', globalPath: '~/.config/opencode/skills', projectPath: '.opencode/skills', icon: { url: opencodeIcon, monochrome: true }, readsSharedByDefault: true },
  { id: 'cursor', name: 'Cursor', shortName: 'Cursor', monogram: 'Cu', globalPath: '~/.cursor/skills', projectPath: '.cursor/skills', icon: { url: cursorIcon, monochrome: true }, readsSharedByDefault: true },
  { id: 'gemini', name: 'Gemini CLI', shortName: 'Gemini', monogram: 'Ge', globalPath: '~/.gemini/skills', projectPath: '.gemini/skills', icon: { url: geminiIcon, monochrome: false }, readsSharedByDefault: true },
  { id: 'copilot', name: 'GitHub Copilot', shortName: 'Copilot', monogram: 'Cp', globalPath: '~/.copilot/skills', projectPath: '.github/skills', icon: { url: copilotIcon, monochrome: true }, readsSharedByDefault: true }
]

// 自定义目录可以不关联任何 agent，统一归到这个分组
export const CUSTOM_AGENT_ID = 'custom'

const AGENT_PRESET_MAP = new Map(AGENT_PRESETS.map((preset) => [preset.id, preset]))

export function getAgentShortName (agentId: string) {
  return AGENT_PRESET_MAP.get(agentId)?.shortName || '自定义'
}

export function getAgentName (agentId: string) {
  return AGENT_PRESET_MAP.get(agentId)?.name || '自定义目录'
}

export function getAgentMonogram (agentId: string) {
  return AGENT_PRESET_MAP.get(agentId)?.monogram || '自'
}

export function getAgentIcon (agentId: string) {
  return AGENT_PRESET_MAP.get(agentId)?.icon || null
}

export function getAgentColorVariable (agentId: string) {
  const colorKey = AGENT_PRESET_MAP.has(agentId) ? agentId : CUSTOM_AGENT_ID
  return `var(--agent-${colorKey})`
}

// 按预设顺序排序，保证每一行里 agent 徽标的顺序一致
export function sortAgentIds (agentIds: Iterable<string>) {
  const order = [...AGENT_PRESETS.map((preset) => preset.id), CUSTOM_AGENT_ID]
  return Array.from(new Set(agentIds)).sort((left, right) => order.indexOf(left) - order.indexOf(right))
}
