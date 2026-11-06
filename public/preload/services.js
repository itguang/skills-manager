const scanner = require('./lib/scanner')
const skillFiles = require('./lib/skill-files')
const { parseSkillContent } = require('./lib/frontmatter')
const { validateSkill } = require('./lib/skill-spec')

// preload 改动后 uTools 不会自动重新加载，前端靠这个版本号发现「页面已更新、preload 还是旧的」。
// 修改了 window.services 的接口或返回结构时，同步递增这里和前端的 REQUIRED_PRELOAD_VERSION
const PRELOAD_VERSION = 3

window.services = {
  version: PRELOAD_VERSION,
  scanSkills: scanner.scanSkills,
  setSkillDisabled: scanner.setSkillDisabled,
  unlinkSkillLocation: scanner.unlinkSkillLocation,
  readSkillFile: scanner.readSkillFile,

  listSkillFiles: skillFiles.listSkillFiles,
  readEditableFile: skillFiles.readEditableFile,
  writeEditableFile: skillFiles.writeEditableFile,
  createSkillFile: skillFiles.createSkillFile,
  resolveSkillFilePath: skillFiles.resolveSkillFilePath,

  // 编辑器里实时校验用，和扫描时使用同一套规则
  validateSkillContent ({ content, directoryName }) {
    return validateSkill(parseSkillContent(content), directoryName)
  }
}
