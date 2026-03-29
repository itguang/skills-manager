const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ENABLED_SKILL_FILE = 'SKILL.md'
const DISABLED_SKILL_FILE = 'SKILL.md.disabled'
const PROJECT_ROOT_TOKEN = '${projectRoot}'

function resolveDirectoryPath (rawPath, projectRoot) {
  const trimmedPath = typeof rawPath === 'string' ? rawPath.trim() : ''
  const trimmedProjectRoot = typeof projectRoot === 'string' ? projectRoot.trim() : ''

  if (!trimmedPath) {
    return {
      configured: false,
      resolvedPath: '',
      reason: '未配置目录'
    }
  }

  let resolvedPath = trimmedPath

  if (resolvedPath.startsWith('~')) {
    resolvedPath = path.join(os.homedir(), resolvedPath.slice(1))
  }

  if (resolvedPath.includes(PROJECT_ROOT_TOKEN)) {
    if (!trimmedProjectRoot) {
      return {
        configured: false,
        resolvedPath: '',
        reason: '未设置项目根目录'
      }
    }
    resolvedPath = resolvedPath.replaceAll(PROJECT_ROOT_TOKEN, trimmedProjectRoot)
  }

  if (!path.isAbsolute(resolvedPath)) {
    if (!trimmedProjectRoot) {
      return {
        configured: false,
        resolvedPath: '',
        reason: '相对路径需要项目根目录'
      }
    }
    resolvedPath = path.resolve(trimmedProjectRoot, resolvedPath)
  }

  return {
    configured: true,
    resolvedPath: path.resolve(resolvedPath),
    reason: ''
  }
}

function getLineIndentSize (line) {
  const match = typeof line === 'string' ? line.match(/^\s*/) : null
  return match ? match[0].length : 0
}

function extractFrontmatter (content) {
  if (!content) return ''

  const normalized = content.replace(/\r\n/g, '\n')
  const frontmatterMatch = normalized.match(/^(?:\uFEFF)?---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)

  return frontmatterMatch ? frontmatterMatch[1] : ''
}

function stripWrappingQuotes (value) {
  return typeof value === 'string' ? value.trim().replace(/^['"]|['"]$/g, '') : ''
}

function extractFieldBlock (lines, key, options = {}) {
  const topLevelOnly = Boolean(options.topLevelOnly)
  const normalizedKey = `${String(key || '').toLowerCase()}:`

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmedLine = typeof line === 'string' ? line.trim() : ''

    if (!trimmedLine) continue
    if (!trimmedLine.toLowerCase().startsWith(normalizedKey)) continue

    const indentSize = getLineIndentSize(line)
    if (topLevelOnly && indentSize > 0) continue

    const rawValue = trimmedLine.slice(normalizedKey.length).trim()
    const childLines = []

    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const childLine = lines[childIndex]
      const childTrimmedLine = typeof childLine === 'string' ? childLine.trim() : ''

      if (!childTrimmedLine) continue

      const childIndentSize = getLineIndentSize(childLine)
      if (childIndentSize <= indentSize) break

      childLines.push(childLine.slice(Math.min(childLine.length, indentSize + 2)))
    }

    return {
      value: stripWrappingQuotes(rawValue),
      childLines
    }
  }

  return {
    value: '',
    childLines: []
  }
}

function parseStringListValue (value, childLines = []) {
  const normalizedValue = stripWrappingQuotes(value)

  if (normalizedValue) {
    if (normalizedValue.startsWith('[') && normalizedValue.endsWith(']')) {
      return normalizedValue
        .slice(1, -1)
        .split(/[,，]/)
        .map((item) => stripWrappingQuotes(item))
        .filter(Boolean)
    }

    return normalizedValue
      .split(/[,，]/)
      .map((item) => stripWrappingQuotes(item))
      .filter(Boolean)
  }

  return childLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => stripWrappingQuotes(line.slice(2)))
    .filter(Boolean)
}

function extractSkillFrontmatterMetadata (content) {
  const frontmatter = extractFrontmatter(content)
  if (!frontmatter) {
    return {
      name: '',
      description: '',
      author: '',
      version: '',
      category: '',
      tags: []
    }
  }

  const lines = frontmatter.split('\n')
  const nameBlock = extractFieldBlock(lines, 'name', { topLevelOnly: true })
  const metadataBlock = extractFieldBlock(lines, 'metadata', { topLevelOnly: true })
  const descriptionBlock = extractFieldBlock(lines, 'description', { topLevelOnly: true })
  const authorTopLevelBlock = extractFieldBlock(lines, 'author', { topLevelOnly: true })
  const authorMetadataBlock = extractFieldBlock(metadataBlock.childLines, 'author')
  const versionTopLevelBlock = extractFieldBlock(lines, 'version', { topLevelOnly: true })
  const versionMetadataBlock = extractFieldBlock(metadataBlock.childLines, 'version')
  const categoryTopLevelBlock = extractFieldBlock(lines, 'category', { topLevelOnly: true })
  const categoryMetadataBlock = extractFieldBlock(metadataBlock.childLines, 'category')
  const tagsTopLevelBlock = extractFieldBlock(lines, 'tags', { topLevelOnly: true })
  const tagsMetadataBlock = extractFieldBlock(metadataBlock.childLines, 'tags')

  return {
    name: nameBlock.value,
    description: descriptionBlock.value,
    author: authorTopLevelBlock.value || authorMetadataBlock.value,
    version: versionTopLevelBlock.value || versionMetadataBlock.value,
    category: categoryTopLevelBlock.value || categoryMetadataBlock.value,
    tags: parseStringListValue(
      tagsTopLevelBlock.value || tagsMetadataBlock.value,
      tagsTopLevelBlock.childLines.length > 0 ? tagsTopLevelBlock.childLines : tagsMetadataBlock.childLines
    )
  }
}

function extractBodyDescription (normalizedContent) {
  const body = normalizedContent.replace(/^(?:\uFEFF)?---\s*\n[\s\S]*?\n---(?:\s*\n|$)/, '')
  const lines = body.split('\n')
  let inCodeBlock = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) continue

    if (trimmedLine.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) continue
    if (trimmedLine.startsWith('#')) continue

    const cleanedLine = trimmedLine.replace(/^>\s?/, '')
    if (cleanedLine) return cleanedLine
  }

  return '暂无描述'
}

function extractSkillSummary (content) {
  if (!content) {
    return {
      name: '',
      description: '暂无描述',
      author: '',
      version: '',
      category: '',
      tags: []
    }
  }

  const normalized = content.replace(/\r\n/g, '\n')
  const metadata = extractSkillFrontmatterMetadata(normalized)

  return {
    name: metadata.name,
    description: metadata.description || extractBodyDescription(normalized),
    author: metadata.author,
    version: metadata.version,
    category: metadata.category,
    tags: metadata.tags
  }
}

function getSkillFileState (skillDirectoryPath) {
  const enabledPath = path.join(skillDirectoryPath, ENABLED_SKILL_FILE)
  const disabledPath = path.join(skillDirectoryPath, DISABLED_SKILL_FILE)

  if (fs.existsSync(enabledPath)) {
    return {
      disabled: false,
      skillFilePath: enabledPath
    }
  }

  if (fs.existsSync(disabledPath)) {
    return {
      disabled: true,
      skillFilePath: disabledPath
    }
  }

  return null
}

function readSkill (directory, entry) {
  const skillDirectoryPath = path.join(directory.resolvedPath, entry.name)
  const fileState = getSkillFileState(skillDirectoryPath)

  if (!fileState) return null

  const skillDirectoryStat = fs.statSync(skillDirectoryPath)
  const content = fs.readFileSync(fileState.skillFilePath, { encoding: 'utf-8' })
  const summary = extractSkillSummary(content)

  return {
    id: `${directory.id}:${entry.name}`,
    name: summary.name || entry.name,
    description: summary.description,
    author: summary.author,
    version: summary.version,
    category: summary.category,
    tags: summary.tags,
    disabled: fileState.disabled,
    createdAt: skillDirectoryStat.birthtimeMs || skillDirectoryStat.mtimeMs || 0,
    directoryId: directory.id,
    directoryLabel: directory.label,
    directoryPath: directory.resolvedPath,
    skillDirPath: skillDirectoryPath,
    skillFilePath: fileState.skillFilePath
  }
}

function scanDirectory (directoryConfig, projectRoot) {
  const resolved = resolveDirectoryPath(directoryConfig.path, projectRoot)
  const baseDirectory = {
    id: directoryConfig.id,
    label: directoryConfig.label,
    path: directoryConfig.path,
    resolvedPath: resolved.resolvedPath,
    configured: resolved.configured,
    exists: false,
    totalSkills: 0,
    enabledSkills: 0,
    disabledSkills: 0,
    reason: resolved.reason
  }

  if (!resolved.configured) {
    return {
      directory: baseDirectory,
      skills: []
    }
  }

  if (!fs.existsSync(resolved.resolvedPath)) {
    return {
      directory: {
        ...baseDirectory,
        reason: '目录不存在'
      },
      skills: []
    }
  }

  const stat = fs.statSync(resolved.resolvedPath)
  if (!stat.isDirectory()) {
    return {
      directory: {
        ...baseDirectory,
        reason: '目标不是目录'
      },
      skills: []
    }
  }

  const skills = fs.readdirSync(resolved.resolvedPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSkill({
      id: directoryConfig.id,
      label: directoryConfig.label,
      resolvedPath: resolved.resolvedPath
    }, entry))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return right.createdAt - left.createdAt
      }

      const nameOrder = left.name.localeCompare(right.name, 'zh-Hans-CN')
      if (nameOrder !== 0) return nameOrder

      return left.directoryLabel.localeCompare(right.directoryLabel, 'zh-Hans-CN')
    })

  const disabledSkills = skills.filter((skill) => skill.disabled).length

  return {
    directory: {
      ...baseDirectory,
      exists: true,
      totalSkills: skills.length,
      enabledSkills: skills.length - disabledSkills,
      disabledSkills,
      reason: ''
    },
    skills
  }
}

window.services = {
  scanSkills ({ directories, projectRoot }) {
    const directoryConfigs = Array.isArray(directories) ? directories : []
    const scannedDirectories = []
    const skills = []

    for (const directoryConfig of directoryConfigs) {
      const result = scanDirectory(directoryConfig, projectRoot)
      scannedDirectories.push(result.directory)
      skills.push(...result.skills)
    }

    skills.sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return right.createdAt - left.createdAt
      }

      const nameOrder = left.name.localeCompare(right.name, 'zh-Hans-CN')
      if (nameOrder !== 0) return nameOrder

      return left.directoryLabel.localeCompare(right.directoryLabel, 'zh-Hans-CN')
    })

    return {
      directories: scannedDirectories,
      skills
    }
  },
  setSkillDisabled ({ skillDirPath, disabled }) {
    const sourcePath = path.join(skillDirPath, disabled ? ENABLED_SKILL_FILE : DISABLED_SKILL_FILE)
    const targetPath = path.join(skillDirPath, disabled ? DISABLED_SKILL_FILE : ENABLED_SKILL_FILE)

    if (!fs.existsSync(sourcePath)) {
      throw new Error(disabled ? '未找到可禁用的 SKILL.md' : '未找到可启用的 SKILL.md.disabled')
    }

    if (fs.existsSync(targetPath)) {
      throw new Error('目标文件已存在，无法切换状态')
    }

    fs.renameSync(sourcePath, targetPath)

    return {
      disabled,
      skillFilePath: targetPath
    }
  },
  removeSkill ({ skillDirPath }) {
    if (!fs.existsSync(skillDirPath)) {
      throw new Error('skill 目录不存在')
    }

    fs.rmSync(skillDirPath, { recursive: true, force: false })
    return true
  }
}
