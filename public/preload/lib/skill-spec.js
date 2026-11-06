// Agent Skills 规范：https://agentskills.io/specification
const NAME_MAX_LENGTH = 64
const DESCRIPTION_MAX_LENGTH = 1024
const COMPATIBILITY_MAX_LENGTH = 500
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validateName (name, directoryName) {
  if (!name) return ['缺少 name 字段']

  const issues = []

  if (name.length > NAME_MAX_LENGTH) {
    issues.push(`name 超过 ${NAME_MAX_LENGTH} 个字符`)
  }

  if (!NAME_PATTERN.test(name)) {
    issues.push('name 只能包含小写字母、数字和单个连字符，且不能以连字符开头或结尾')
  }

  if (name !== directoryName) {
    issues.push(`name「${name}」与目录名「${directoryName}」不一致`)
  }

  return issues
}

function validateSkill (parsedSkill, directoryName) {
  if (!parsedSkill.hasFrontmatter) {
    return ['缺少 YAML frontmatter']
  }

  if (parsedSkill.parseError) {
    return [`frontmatter 解析失败：${parsedSkill.parseError}`]
  }

  const issues = validateName(parsedSkill.name, directoryName)

  if (!parsedSkill.declaredDescription) {
    issues.push('缺少 description 字段')
  } else if (parsedSkill.declaredDescription.length > DESCRIPTION_MAX_LENGTH) {
    issues.push(`description 超过 ${DESCRIPTION_MAX_LENGTH} 个字符`)
  }

  if (parsedSkill.compatibility.length > COMPATIBILITY_MAX_LENGTH) {
    issues.push(`compatibility 超过 ${COMPATIBILITY_MAX_LENGTH} 个字符`)
  }

  return issues
}

module.exports = {
  validateSkill
}
