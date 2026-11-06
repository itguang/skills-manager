import { ElMessage } from 'element-plus'

export function showNotification (message: string) {
  window.utools.showNotification(message)
}

export function getErrorMessage (error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message ? error.message : fallbackMessage
}

function normalizeSlashes (value: string) {
  return value.replace(/\\/g, '/')
}

let cachedHomeDirectory: string | null = null

function getHomeDirectory () {
  if (cachedHomeDirectory !== null) return cachedHomeDirectory

  try {
    cachedHomeDirectory = normalizeSlashes(window.utools.getPath('home') || '')
  } catch (error) {
    cachedHomeDirectory = ''
  }
  return cachedHomeDirectory
}

// 把用户目录前缀替换成 ~，让路径在窄窗口里也能看清关键部分
export function compactDisplayPath (rawPath: string) {
  const normalizedPath = normalizeSlashes(rawPath || '')
  const homeDirectory = getHomeDirectory()

  if (!homeDirectory) return normalizedPath
  if (normalizedPath === homeDirectory) return '~'
  if (normalizedPath.startsWith(`${homeDirectory}/`)) {
    return `~${normalizedPath.slice(homeDirectory.length)}`
  }
  return normalizedPath
}

export function getBaseName (rawPath: string) {
  const segments = normalizeSlashes(rawPath || '').split('/').filter(Boolean)
  return segments[segments.length - 1] || rawPath
}

// 不同 uTools 版本的 showOpenDialog 返回值格式不完全一致，这里统一取出第一个目录路径
function extractDialogDirectoryPath (result: any): string {
  if (!result) return ''

  if (typeof result === 'object' && !Array.isArray(result)) {
    if (Array.isArray(result.filePaths) && result.filePaths.length > 0) return result.filePaths[0]
    if (typeof result.path === 'string') return result.path
    if (typeof result.filePath === 'string') return result.filePath
    return ''
  }

  if (!Array.isArray(result) || result.length === 0) return ''

  const first = result[0]
  if (typeof first === 'string') return first
  if (first && typeof first.path === 'string') return first.path
  if (first && typeof first.filePath === 'string') return first.filePath
  return ''
}

export function pickDirectory (title: string) {
  const result = window.utools.showOpenDialog({
    title,
    properties: ['openDirectory']
  })
  return extractDialogDirectoryPath(result)
}

export function copyText (text: string, successMessage = '已复制') {
  if (!text) {
    ElMessage.error('内容为空，无法复制')
    return
  }

  try {
    const copied = window.utools.copyText(text)
    if (copied === false) {
      ElMessage.error('复制失败')
      return
    }
    ElMessage.success(successMessage)
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '复制失败'))
  }
}

export function openPath (fullPath: string) {
  if (!fullPath) {
    showNotification('路径为空，无法打开')
    return
  }

  try {
    window.utools.shellOpenPath(fullPath)
  } catch (error) {
    showNotification(getErrorMessage(error, '打开失败'))
  }
}

export function createId (prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
