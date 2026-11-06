import type { ScanResult, ScanSource } from '../SkillManager/types'
import type { FileTreeNode } from '../SkillManager/editor/FileTree.vue'

interface EditableFile {
  editable: boolean
  reason: string
  content: string
  mtimeMs: number
  absolutePath: string
}

interface SkillFileTarget {
  skillRoot: string
  relativePath: string
}

declare global {
  interface Window {
    services: {
      version?: number
      scanSkills (options: { sources: ScanSource[], projectRoot: string }): ScanResult
      setSkillDisabled (options: { realPath: string, disabled: boolean }): { disabled: boolean, skillFilePath: string }
      unlinkSkillLocation (options: { entryPath: string }): boolean
      readSkillFile (options: { skillFilePath: string }): string

      listSkillFiles (options: { skillRoot: string }): { nodes: FileTreeNode[], truncated: boolean }
      readEditableFile (options: SkillFileTarget): EditableFile
      // 文件在读取后被外部修改时抛出 code 为 FILE_CONFLICT 的错误，force 为 true 时强制覆盖
      writeEditableFile (options: SkillFileTarget & { content: string, expectedMtimeMs: number, force?: boolean }): { mtimeMs: number }
      createSkillFile (options: SkillFileTarget): { relativePath: string }
      resolveSkillFilePath (options: SkillFileTarget): string
      validateSkillContent (options: { content: string, directoryName: string }): string[]
    }
  }
}

export {}
