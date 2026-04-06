# Skill Tag Display Limit Design

## Summary

Limit the number of regular tags shown in the skill list to at most 5 per skill card.
The category tag remains visible when present and does not count toward the 5-tag limit.

## Current State

The skill list in `src/SkillManager/index.vue` renders:

- one category tag from `skill.category`
- all regular tags returned by `getSkillTags(skill)`

This can make a single row too wide when a skill contains many tags.

## Goal

Keep the existing compact single-line layout by capping visible regular tags while preserving:

- current category tag rendering
- current tag parsing and normalization behavior
- current metadata layout for name, version, author, and actions

## Approach

Use a presentation-layer limit instead of mutating source data.

### Data Handling

- Keep `getSkillTags(skill)` responsible for parsing and normalizing raw tag metadata.
- Add a `MAX_VISIBLE_SKILL_TAGS = 5` constant.
- Add `getVisibleSkillTags(skill)` that returns `getSkillTags(skill).slice(0, MAX_VISIBLE_SKILL_TAGS)`.

### Rendering

- Continue rendering `skill.category` independently.
- Render regular tags from `getVisibleSkillTags(skill)`.
- Use the visible-tag result for any conditional UI related to the regular-tag area so the icon and tags stay in sync.

## Rejected Alternatives

### Slice directly in the template

This is the smallest code diff but makes the template noisier and repeats tag computation logic.

### Truncate tags during scan or normalization

This would discard original metadata too early and makes future enhancements harder, such as showing all tags elsewhere.

## Validation

- Build the project with `npm run build`.
- Confirm that a skill with more than 5 regular tags shows only the first 5 regular tags.
- Confirm that `skill.category` still renders even when 5 regular tags are already shown.
- Confirm that skills with fewer than 5 regular tags are unaffected.
