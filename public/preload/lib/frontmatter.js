const YAML = require('yaml')

const FRONTMATTER_PATTERN = /^(?:﻿)?---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/
const FALLBACK_DESCRIPTION = '暂无描述'

function normalizeLineBreaks (content) {
  return typeof content === 'string' ? content.replace(/\r\n/g, '\n') : ''
}

function splitFrontmatter (content) {
  const normalized = normalizeLineBreaks(content)
  const match = normalized.match(FRONTMATTER_PATTERN)

  if (!match) {
    return { rawFrontmatter: '', body: normalized }
  }

  return {
    rawFrontmatter: match[1],
    body: normalized.slice(match[0].length)
  }
}

// 解析失败时不抛异常：一个 skill 写错 YAML 不应该让整个列表扫描失败，
// 错误信息会作为规范问题展示给用户
function parseYamlObject (rawFrontmatter) {
  if (!rawFrontmatter.trim()) {
    return { data: {}, parseError: '' }
  }

  try {
    const parsed = YAML.parse(rawFrontmatter)
    const isPlainObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    return { data: isPlainObject ? parsed : {}, parseError: '' }
  } catch (error) {
    return { data: {}, parseError: error && error.message ? error.message : 'YAML 解析失败' }
  }
}

function toTrimmedString (value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function toStringList (value) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，]/)
      : []

  return rawItems
    .map((item) => toTrimmedString(item))
    .filter(Boolean)
}

// allowed-tools 在规范里是空格分隔的字符串，部分工具也写成 YAML 列表
function toToolList (value) {
  if (Array.isArray(value)) return toStringList(value)
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
  return []
}

// 规范把 author / version 等扩展字段放在 metadata 下，但很多 skill 直接写在顶层，两处都要兼容
function pickField (data, metadata, key) {
  return toTrimmedString(data[key]) || toTrimmedString(metadata[key])
}

function extractBodyDescription (body) {
  let inCodeBlock = false

  for (const line of body.split('\n')) {
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

  return FALLBACK_DESCRIPTION
}

function parseSkillContent (content) {
  const { rawFrontmatter, body } = splitFrontmatter(content)
  const { data, parseError } = parseYamlObject(rawFrontmatter)
  const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
    ? data.metadata
    : {}
  const declaredDescription = toTrimmedString(data.description)

  return {
    hasFrontmatter: Boolean(rawFrontmatter),
    parseError,
    name: toTrimmedString(data.name),
    declaredDescription,
    description: declaredDescription || extractBodyDescription(body),
    author: pickField(data, metadata, 'author'),
    version: pickField(data, metadata, 'version'),
    category: pickField(data, metadata, 'category'),
    license: toTrimmedString(data.license),
    compatibility: toTrimmedString(data.compatibility),
    allowedTools: toToolList(data['allowed-tools']),
    tags: toStringList(data.tags !== undefined ? data.tags : metadata.tags),
    metadata
  }
}

module.exports = {
  parseSkillContent,
  splitFrontmatter
}
