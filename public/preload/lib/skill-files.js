const fs = require('node:fs')
const path = require('node:path')

const MAX_EDITABLE_BYTES = 1024 * 1024
const MAX_TREE_ENTRIES = 500
const MAX_TREE_DEPTH = 5
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv'])
const IGNORED_FILE_NAMES = new Set(['.DS_Store'])
const BINARY_SNIFF_BYTES = 8000

// 所有文件操作都必须落在 skill 目录内，防止前端传入 ../ 之类的路径越界读写
function resolveInsideSkill (skillRoot, relativePath) {
  const root = path.resolve(skillRoot)
  const target = path.resolve(root, relativePath || '')

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('路径超出 skill 目录范围')
  }
  return target
}

function toPosixPath (value) {
  return value.split(path.sep).join('/')
}

function compareTreeNodes (left, right) {
  if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
  return left.name.localeCompare(right.name)
}

function listSkillFiles ({ skillRoot }) {
  const root = path.resolve(skillRoot)
  let entryCount = 0
  let truncated = false

  function walk (directoryPath, depth) {
    const nodes = []

    for (const dirent of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      if (IGNORED_FILE_NAMES.has(dirent.name) || IGNORED_DIRECTORY_NAMES.has(dirent.name)) continue
      if (entryCount >= MAX_TREE_ENTRIES) {
        truncated = true
        break
      }

      const absolutePath = path.join(directoryPath, dirent.name)
      const relativePath = toPosixPath(path.relative(root, absolutePath))
      let stat
      try {
        stat = fs.statSync(absolutePath)
      } catch (error) {
        continue
      }

      entryCount += 1

      if (stat.isDirectory()) {
        const children = depth < MAX_TREE_DEPTH ? walk(absolutePath, depth + 1) : []
        nodes.push({ type: 'directory', name: dirent.name, path: relativePath, children })
      } else if (stat.isFile()) {
        nodes.push({ type: 'file', name: dirent.name, path: relativePath, size: stat.size })
      }
    }

    return nodes.sort(compareTreeNodes)
  }

  return { nodes: walk(root, 1), truncated }
}

function looksBinary (buffer) {
  const sampleLength = Math.min(buffer.length, BINARY_SNIFF_BYTES)
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) return true
  }
  return false
}

function readEditableFile ({ skillRoot, relativePath }) {
  const filePath = resolveInsideSkill(skillRoot, relativePath)
  const stat = fs.statSync(filePath)

  if (!stat.isFile()) throw new Error('目标不是文件')
  if (stat.size > MAX_EDITABLE_BYTES) {
    return { editable: false, reason: '文件超过 1MB，请用外部编辑器打开', content: '', mtimeMs: stat.mtimeMs, absolutePath: filePath }
  }

  const buffer = fs.readFileSync(filePath)
  if (looksBinary(buffer)) {
    return { editable: false, reason: '二进制文件，不支持在插件内编辑', content: '', mtimeMs: stat.mtimeMs, absolutePath: filePath }
  }

  return { editable: true, reason: '', content: buffer.toString('utf-8'), mtimeMs: stat.mtimeMs, absolutePath: filePath }
}

// expectedMtimeMs 是读取时的修改时间：如果文件在这期间被其它工具改过，拒绝覆盖并让用户决定
function writeEditableFile ({ skillRoot, relativePath, content, expectedMtimeMs, force }) {
  const filePath = resolveInsideSkill(skillRoot, relativePath)

  if (!force && typeof expectedMtimeMs === 'number' && fs.existsSync(filePath)) {
    const currentMtimeMs = fs.statSync(filePath).mtimeMs
    if (Math.abs(currentMtimeMs - expectedMtimeMs) > 1) {
      const conflictError = new Error('文件已被其它程序修改')
      conflictError.code = 'FILE_CONFLICT'
      throw conflictError
    }
  }

  // 先写临时文件再改名，避免写到一半失败时把原文件写坏
  const temporaryPath = `${filePath}.skills-manager-${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, content, { encoding: 'utf-8' })
  fs.renameSync(temporaryPath, filePath)

  return { mtimeMs: fs.statSync(filePath).mtimeMs }
}

function createSkillFile ({ skillRoot, relativePath }) {
  const filePath = resolveInsideSkill(skillRoot, relativePath)

  if (fs.existsSync(filePath)) throw new Error('同名文件已存在')

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, '', { encoding: 'utf-8', flag: 'wx' })
  return { relativePath: toPosixPath(path.relative(path.resolve(skillRoot), filePath)) }
}

function resolveSkillFilePath ({ skillRoot, relativePath }) {
  return resolveInsideSkill(skillRoot, relativePath)
}

module.exports = {
  listSkillFiles,
  readEditableFile,
  writeEditableFile,
  createSkillFile,
  resolveSkillFilePath
}
