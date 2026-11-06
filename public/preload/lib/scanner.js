const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { parseSkillContent } = require('./frontmatter')
const { validateSkill } = require('./skill-spec')

const ENABLED_SKILL_FILE = 'SKILL.md'
const DISABLED_SKILL_FILE = 'SKILL.md.disabled'
const PROJECT_ROOT_TOKEN = '${projectRoot}'
const ENV_TOKEN_PATTERN = /\$\{?([A-Z_][A-Z0-9_]*)\}?/g

// 环境变量没设置时使用各工具自己的默认值，例如 Codex 未设置 CODEX_HOME 时使用 ~/.codex
const ENV_FALLBACKS = {
  CODEX_HOME: '~/.codex'
}

function expandHomeDirectory (rawPath) {
  if (rawPath === '~') return os.homedir()
  if (rawPath.startsWith('~/') || rawPath.startsWith('~\\')) {
    return path.join(os.homedir(), rawPath.slice(2))
  }
  return rawPath
}

function expandEnvironmentVariables (rawPath) {
  const missingNames = []
  const expandedPath = rawPath.replace(ENV_TOKEN_PATTERN, (token, name) => {
    const value = process.env[name] || ENV_FALLBACKS[name]
    if (!value) {
      missingNames.push(name)
      return token
    }
    return value
  })

  return { expandedPath, missingNames }
}

function resolveDirectoryPath (rawPath, projectRoot) {
  const trimmedPath = typeof rawPath === 'string' ? rawPath.trim() : ''
  const trimmedProjectRoot = typeof projectRoot === 'string' ? projectRoot.trim() : ''

  if (!trimmedPath) {
    return { resolvedPath: '', reason: '未配置目录' }
  }

  let resolvedPath = trimmedPath

  if (resolvedPath.includes(PROJECT_ROOT_TOKEN)) {
    if (!trimmedProjectRoot) {
      return { resolvedPath: '', reason: '未选择项目' }
    }
    resolvedPath = resolvedPath.split(PROJECT_ROOT_TOKEN).join(trimmedProjectRoot)
  }

  const { expandedPath, missingNames } = expandEnvironmentVariables(resolvedPath)
  if (missingNames.length > 0) {
    return { resolvedPath: '', reason: `环境变量 ${missingNames.join('、')} 未设置` }
  }

  resolvedPath = expandHomeDirectory(expandedPath)

  if (!path.isAbsolute(resolvedPath)) {
    if (!trimmedProjectRoot) {
      return { resolvedPath: '', reason: '未选择项目' }
    }
    resolvedPath = path.resolve(trimmedProjectRoot, resolvedPath)
  }

  return { resolvedPath: path.resolve(resolvedPath), reason: '' }
}

function getSkillFileState (skillDirectoryPath) {
  const enabledPath = path.join(skillDirectoryPath, ENABLED_SKILL_FILE)
  if (fs.existsSync(enabledPath)) {
    return { disabled: false, skillFilePath: enabledPath }
  }

  const disabledPath = path.join(skillDirectoryPath, DISABLED_SKILL_FILE)
  if (fs.existsSync(disabledPath)) {
    return { disabled: true, skillFilePath: disabledPath }
  }

  return null
}

// entryPath 是扫描目录里看到的路径（可能是软链接），界面上展示、打开、编辑都用它；
// realPath 只用来识别多个软链接指向的是同一个 skill
function readSkill (entryPath, realPath, fileState) {
  const content = fs.readFileSync(fileState.skillFilePath, { encoding: 'utf-8' })
  const parsed = parseSkillContent(content)
  // agent 按链接名加载 skill，所以规范要求的「name 与目录名一致」也以链接名为准
  const directoryName = path.basename(entryPath)
  const directoryStat = fs.statSync(realPath)

  return {
    id: realPath,
    name: parsed.name || directoryName,
    directoryName,
    description: parsed.description,
    author: parsed.author,
    version: parsed.version,
    category: parsed.category,
    license: parsed.license,
    compatibility: parsed.compatibility,
    allowedTools: parsed.allowedTools,
    tags: parsed.tags,
    metadata: parsed.metadata,
    specIssues: validateSkill(parsed, directoryName),
    disabled: fileState.disabled,
    createdAt: directoryStat.birthtimeMs || directoryStat.mtimeMs || 0,
    path: entryPath,
    realPath,
    skillFilePath: fileState.skillFilePath,
    locations: []
  }
}

function createSourceResult (source, resolved) {
  return {
    id: source.id,
    agentId: source.agentId || '',
    scope: source.scope,
    label: source.label || '',
    path: source.path,
    resolvedPath: resolved.resolvedPath,
    exists: false,
    totalSkills: 0,
    reason: resolved.reason
  }
}

function checkSourceDirectory (resolvedPath) {
  if (!fs.existsSync(resolvedPath)) return '目录不存在'
  if (!fs.statSync(resolvedPath).isDirectory()) return '目标不是目录'
  return ''
}

// 软链接要用 statSync 跟随到目标，Dirent.isDirectory() 对软链接永远返回 false
function inspectEntry (entryPath, dirent) {
  const isSymlink = dirent.isSymbolicLink()

  if (!isSymlink) {
    return { isDirectory: dirent.isDirectory(), isSymlink, brokenReason: '' }
  }

  try {
    return { isDirectory: fs.statSync(entryPath).isDirectory(), isSymlink, brokenReason: '' }
  } catch (error) {
    return { isDirectory: false, isSymlink, brokenReason: '软链接目标不存在' }
  }
}

function addLocation (skill, location) {
  const alreadyAdded = skill.locations.some((item) => item.entryPath === location.entryPath)
  if (!alreadyAdded) skill.locations.push(location)
}

function scanSource (source, projectRoot, skillsByRealPath, problems) {
  const result = createSourceResult(source, resolveDirectoryPath(source.path, projectRoot))
  if (result.reason) return result

  result.reason = checkSourceDirectory(result.resolvedPath)
  if (result.reason) return result

  result.exists = true

  for (const dirent of fs.readdirSync(result.resolvedPath, { withFileTypes: true })) {
    if (dirent.name.startsWith('.')) continue

    const entryPath = path.join(result.resolvedPath, dirent.name)
    const entry = inspectEntry(entryPath, dirent)

    if (entry.brokenReason) {
      problems.push({ kind: 'broken-link', sourceId: source.id, entryPath, reason: entry.brokenReason })
      continue
    }
    if (!entry.isDirectory) continue

    try {
      const fileState = getSkillFileState(entryPath)
      if (!fileState) continue

      const realPath = fs.realpathSync(entryPath)
      // 扫描顺序里第一次看到的位置作为主路径，「全局」目录排在最前，所以优先显示 ~/.agents/skills 下的路径
      if (!skillsByRealPath.has(realPath)) {
        skillsByRealPath.set(realPath, readSkill(entryPath, realPath, fileState))
      }

      addLocation(skillsByRealPath.get(realPath), {
        sourceId: source.id,
        agentId: source.agentId || '',
        scope: source.scope,
        entryPath,
        isSymlink: entry.isSymlink
      })
      result.totalSkills += 1
    } catch (error) {
      problems.push({ kind: 'read-error', sourceId: source.id, entryPath, reason: error && error.message ? error.message : '读取失败' })
    }
  }

  return result
}

function compareSkills (left, right) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt
  }
  return left.name.localeCompare(right.name, 'zh-Hans-CN')
}

function scanSkills ({ sources, projectRoot }) {
  const sourceConfigs = Array.isArray(sources) ? sources : []
  const skillsByRealPath = new Map()
  const problems = []

  const scannedSources = sourceConfigs.map((source) => scanSource(source, projectRoot, skillsByRealPath, problems))

  return {
    sources: scannedSources,
    skills: Array.from(skillsByRealPath.values()).sort(compareSkills),
    problems
  }
}

function setSkillDisabled ({ realPath, disabled }) {
  const sourcePath = path.join(realPath, disabled ? ENABLED_SKILL_FILE : DISABLED_SKILL_FILE)
  const targetPath = path.join(realPath, disabled ? DISABLED_SKILL_FILE : ENABLED_SKILL_FILE)

  if (!fs.existsSync(sourcePath)) {
    throw new Error(disabled ? '未找到可禁用的 SKILL.md' : '未找到可启用的 SKILL.md.disabled')
  }

  if (fs.existsSync(targetPath)) {
    throw new Error('目标文件已存在，无法切换状态')
  }

  fs.renameSync(sourcePath, targetPath)

  return { disabled, skillFilePath: targetPath }
}

// 只负责解除软链接；真实目录由前端调用 utools.shellTrashItem 移到废纸篓，避免误删无法恢复
function unlinkSkillLocation ({ entryPath }) {
  const stat = fs.lstatSync(entryPath)
  if (!stat.isSymbolicLink()) {
    throw new Error('该位置不是软链接，不能直接解除')
  }
  fs.unlinkSync(entryPath)
  return true
}

function readSkillFile ({ skillFilePath }) {
  return fs.readFileSync(skillFilePath, { encoding: 'utf-8' })
}

module.exports = {
  scanSkills,
  setSkillDisabled,
  unlinkSkillLocation,
  readSkillFile,
  resolveDirectoryPath
}
