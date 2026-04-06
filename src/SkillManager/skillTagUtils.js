const TAG_SPLIT_REGEX = /[,，]/
export const MAX_VISIBLE_SKILL_TAGS = 5

export function getSkillTags (skill) {
  const rawTags = Array.isArray(skill?.tags)
    ? skill.tags
    : typeof skill?.tags === 'string'
      ? [skill.tags]
      : []

  return rawTags
    .flatMap((tag) => (typeof tag === 'string' ? tag.split(TAG_SPLIT_REGEX) : []))
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function getVisibleSkillTags (skill) {
  const tags = getSkillTags(skill)
  return tags.slice(0, MAX_VISIBLE_SKILL_TAGS)
}
