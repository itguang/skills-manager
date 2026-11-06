import { isMap, parseDocument } from 'yaml'
import type { Document } from 'yaml'

const FRONTMATTER_PATTERN = /^(﻿?---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*)(?:\r?\n|$)/

export interface SplitMarkdown {
  hasFrontmatter: boolean
  frontmatter: string
  body: string
}

export function splitMarkdown (content: string): SplitMarkdown {
  const match = content.match(FRONTMATTER_PATTERN)
  if (!match) return { hasFrontmatter: false, frontmatter: '', body: content }

  return {
    hasFrontmatter: true,
    frontmatter: match[2],
    body: content.slice(match[0].length).replace(/^\r?\n/, '')
  }
}

export function joinMarkdown (frontmatter: string, body: string) {
  const trimmedFrontmatter = frontmatter.replace(/\s+$/, '')
  if (!trimmedFrontmatter) return body
  return `---\n${trimmedFrontmatter}\n---\n\n${body.replace(/^\n+/, '')}`
}

// 表单只覆盖规范里的常用字段；其余字段、注释、键顺序都保留在 YAML 文档里不动
export interface FrontmatterFields {
  name: string
  description: string
  license: string
  compatibility: string
  allowedTools: string
  version: string
  author: string
  category: string
  tags: string[]
}

export interface ParsedFrontmatter {
  document: Document
  fields: FrontmatterFields
  error: string
}

function readString (document: Document, path: string[]) {
  const value = document.getIn(path)
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function readStringList (document: Document, path: string[]) {
  const value = document.getIn(path) as any
  const items = value && typeof value.toJSON === 'function' ? value.toJSON() : value
  if (Array.isArray(items)) return items.map((item) => String(item)).filter(Boolean)
  if (typeof items === 'string') return items.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
  return []
}

// 扩展字段既可能写在顶层也可能写在 metadata 下，读写时都优先沿用文件里已有的位置
function locateExtensionField (document: Document, key: string) {
  if (document.hasIn([key])) return [key]
  return ['metadata', key]
}

export function parseFrontmatter (frontmatter: string): ParsedFrontmatter {
  const document = parseDocument(frontmatter)
  const error = document.errors[0]?.message.split('\n')[0] || ''
  const contentsIsMap = !document.contents || isMap(document.contents)

  return {
    document,
    error: error || (contentsIsMap ? '' : 'frontmatter 必须是键值对'),
    fields: {
      name: readString(document, ['name']),
      description: readString(document, ['description']),
      license: readString(document, ['license']),
      compatibility: readString(document, ['compatibility']),
      allowedTools: readStringList(document, ['allowed-tools']).join(' '),
      version: readString(document, locateExtensionField(document, 'version')),
      author: readString(document, locateExtensionField(document, 'author')),
      category: readString(document, locateExtensionField(document, 'category')),
      tags: readStringList(document, locateExtensionField(document, 'tags'))
    }
  }
}

function writeOptional (document: Document, path: string[], value: string | string[]) {
  const isEmpty = Array.isArray(value) ? value.length === 0 : !value.trim()
  if (isEmpty) {
    if (document.hasIn(path)) document.deleteIn(path)
    return
  }
  document.setIn(path, Array.isArray(value) ? value : value.trim())
}

function removeEmptyMetadata (document: Document) {
  const metadata = document.get('metadata') as any
  if (metadata && isMap(metadata) && metadata.items.length === 0) {
    document.delete('metadata')
  }
}

export function applyFrontmatterFields (frontmatter: string, fields: FrontmatterFields) {
  const { document, error } = parseFrontmatter(frontmatter)
  if (error) throw new Error(`frontmatter 格式错误：${error}`)

  // name、description 是规范必填项，即使为空也保留键，方便用户看到并补全
  document.setIn(['name'], fields.name.trim())
  document.setIn(['description'], fields.description.trim())

  writeOptional(document, ['license'], fields.license)
  writeOptional(document, ['compatibility'], fields.compatibility)
  writeOptional(document, ['allowed-tools'], fields.allowedTools)
  writeOptional(document, locateExtensionField(document, 'version'), fields.version)
  writeOptional(document, locateExtensionField(document, 'author'), fields.author)
  writeOptional(document, locateExtensionField(document, 'category'), fields.category)
  writeOptional(document, locateExtensionField(document, 'tags'), fields.tags)
  removeEmptyMetadata(document)

  return document.toString({ lineWidth: 0 })
}
