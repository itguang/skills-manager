import { computed, reactive } from 'vue'
import type { Ref } from 'vue'
import { CUSTOM_AGENT_ID, SHARED_AGENT_ID, sortAgentIds } from './agents'
import type { Skill, SourceScope } from './types'

export type StatusFilter = 'all' | 'enabled' | 'disabled'
export type ScopeFilter = 'all' | SourceScope

export const ALL_AGENTS = 'all'

function createDefaultFilters () {
  return {
    keyword: '',
    agentId: ALL_AGENTS,
    status: 'all' as StatusFilter,
    scope: 'all' as ScopeFilter,
    category: '',
    specIssuesOnly: false
  }
}

export function isInSharedDirectory (skill: Skill) {
  return skill.locations.some((location) => location.agentId === SHARED_AGENT_ID)
}

// skill 对哪些 agent 可用：所在目录对应的 agent，加上全局目录里的 skill 对所有读取全局目录的 agent 可用。
// 结果包含 SHARED_AGENT_ID，供「全局」标签筛选使用
export function getSkillAgentIds (skill: Skill, sharedReaderIds: string[]) {
  const agentIds = skill.locations.map((location) => location.agentId || CUSTOM_AGENT_ID)
  if (isInSharedDirectory(skill)) agentIds.push(...sharedReaderIds)
  return sortAgentIds(agentIds)
}

function matchesKeyword (skill: Skill, keyword: string) {
  if (!keyword) return true

  return [
    skill.name,
    skill.directoryName,
    skill.description,
    skill.author,
    skill.category,
    skill.tags.join(' ')
  ].join(' ').toLowerCase().includes(keyword)
}

export function useSkillFilters (skills: Ref<Skill[]>, sharedReaderIds: Ref<string[]>) {
  const filters = reactive(createDefaultFilters())

  // agent 标签上的数量要反映其它筛选条件的结果，所以单独拆出「除 agent 外」的过滤
  const skillsBeforeAgentFilter = computed(() => {
    const keyword = filters.keyword.trim().toLowerCase()

    return skills.value.filter((skill) => {
      if (filters.status === 'enabled' && skill.disabled) return false
      if (filters.status === 'disabled' && !skill.disabled) return false
      if (filters.scope !== 'all' && !skill.locations.some((location) => location.scope === filters.scope)) return false
      if (filters.category && skill.category !== filters.category) return false
      if (filters.specIssuesOnly && skill.specIssues.length === 0) return false
      return matchesKeyword(skill, keyword)
    })
  })

  const filteredSkills = computed(() => {
    if (filters.agentId === ALL_AGENTS) return skillsBeforeAgentFilter.value
    return skillsBeforeAgentFilter.value.filter((skill) => getSkillAgentIds(skill, sharedReaderIds.value).includes(filters.agentId))
  })

  const matchedSkillCount = computed(() => skillsBeforeAgentFilter.value.length)

  const agentCounts = computed(() => {
    const counts = new Map<string, number>()
    for (const skill of skillsBeforeAgentFilter.value) {
      for (const agentId of getSkillAgentIds(skill, sharedReaderIds.value)) {
        counts.set(agentId, (counts.get(agentId) || 0) + 1)
      }
    }
    return counts
  })

  const categories = computed(() => {
    const names = new Set(skills.value.map((skill) => skill.category).filter(Boolean))
    return Array.from(names).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
  })

  // 关键词和 agent 标签在界面上一直可见，不计入「筛选」按钮的角标
  const activeFilterCount = computed(() => [
    filters.status !== 'all',
    filters.scope !== 'all',
    Boolean(filters.category),
    filters.specIssuesOnly
  ].filter(Boolean).length)

  function resetPopoverFilters () {
    const defaults = createDefaultFilters()
    filters.status = defaults.status
    filters.scope = defaults.scope
    filters.category = defaults.category
    filters.specIssuesOnly = defaults.specIssuesOnly
  }

  function resetAllFilters () {
    Object.assign(filters, createDefaultFilters())
  }

  return {
    filters,
    filteredSkills,
    matchedSkillCount,
    agentCounts,
    categories,
    activeFilterCount,
    resetPopoverFilters,
    resetAllFilters
  }
}
