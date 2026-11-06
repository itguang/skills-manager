export type SourceScope = 'global' | 'project' | 'custom'

export interface ScanSource {
  id: string
  agentId: string
  scope: SourceScope
  label?: string
  path: string
}

export interface SkillLocation {
  sourceId: string
  agentId: string
  scope: SourceScope
  entryPath: string
  isSymlink: boolean
}

export interface Skill {
  id: string
  name: string
  directoryName: string
  description: string
  author: string
  version: string
  category: string
  license: string
  compatibility: string
  allowedTools: string[]
  tags: string[]
  metadata: Record<string, unknown>
  specIssues: string[]
  disabled: boolean
  createdAt: number
  // 扫描目录中看到的路径，软链接保持链接路径，界面展示和文件操作都用它
  path: string
  // 软链接解析后的真实路径，只用于识别同一个 skill
  realPath: string
  skillFilePath: string
  locations: SkillLocation[]
}

export interface ScannedSource {
  id: string
  agentId: string
  scope: SourceScope
  label: string
  path: string
  resolvedPath: string
  exists: boolean
  totalSkills: number
  reason: string
}

export interface ScanProblem {
  kind: 'broken-link' | 'read-error'
  sourceId: string
  entryPath: string
  reason: string
}

export interface ScanResult {
  sources: ScannedSource[]
  skills: Skill[]
  problems: ScanProblem[]
}
