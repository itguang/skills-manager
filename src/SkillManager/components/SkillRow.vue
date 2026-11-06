<script lang="ts" setup>
import { computed } from 'vue'
import { CopyDocument, EditPen, MoreFilled, WarningFilled } from '@element-plus/icons-vue'
import AgentAvatars from './AgentAvatars.vue'
import AgentBadge from './AgentBadge.vue'
import { SHARED_AGENT_ID } from '../agents'
import type { Skill } from '../types'

export type SkillRowCommand = 'edit' | 'open-directory' | 'copy-name' | 'copy-path' | 'delete'

const props = defineProps<{
  skill: Skill
  // 对该 skill 可用的 agent（含 SHARED_AGENT_ID），由列表统一按当前配置计算
  agentIds: string[]
  active: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  open: []
  toggle: []
  command: [command: SkillRowCommand]
}>()

const isShared = computed(() => props.agentIds.includes(SHARED_AGENT_ID))
const usableAgentIds = computed(() => props.agentIds.filter((agentId) => agentId !== SHARED_AGENT_ID))
const hasProjectLocation = computed(() => props.skill.locations.some((location) => location.scope === 'project'))
const MAX_VISIBLE_TAGS = 3
const visibleTags = computed(() => props.skill.tags.slice(0, MAX_VISIBLE_TAGS))
const hiddenTagCount = computed(() => Math.max(props.skill.tags.length - MAX_VISIBLE_TAGS, 0))
</script>

<template>
  <div
    :class="['skill-row', { 'is-active': active, 'is-disabled': skill.disabled }]"
    role="button"
    tabindex="-1"
    @click="emit('open')"
  >
    <div class="row-main">
      <div class="row-title">
        <span class="skill-name" :title="skill.name">{{ skill.name }}</span>

        <button
          class="icon-button row-copy"
          type="button"
          title="复制名称"
          :aria-label="`复制 ${skill.name}`"
          @click.stop="emit('command', 'copy-name')"
        >
          <el-icon><CopyDocument /></el-icon>
        </button>

        <el-tooltip v-if="skill.specIssues.length" placement="top" :show-after="200">
          <template #content>
            <div v-for="issue in skill.specIssues" :key="issue">{{ issue }}</div>
          </template>
          <el-icon class="spec-warning"><WarningFilled /></el-icon>
        </el-tooltip>

        <span v-if="skill.version" class="row-meta">v{{ skill.version.replace(/^v/i, '') }}</span>
        <span v-if="skill.author" class="row-meta row-meta--author" :title="skill.author">{{ skill.author }}</span>
        <span v-if="skill.category" class="row-category">{{ skill.category }}</span>
        <span v-for="tag in visibleTags" :key="tag" class="row-tag">#{{ tag }}</span>
        <span v-if="hiddenTagCount" class="row-tag" :title="skill.tags.join('、')">+{{ hiddenTagCount }}</span>
      </div>

      <p class="row-description" :title="skill.description">{{ skill.description }}</p>
    </div>

    <div class="row-side" @click.stop>
      <span v-if="hasProjectLocation" class="scope-chip">项目</span>
      <AgentBadge v-if="isShared" :agent-id="SHARED_AGENT_ID" />
      <AgentAvatars :agent-ids="usableAgentIds" />

      <button
        class="icon-button row-edit"
        type="button"
        title="编辑"
        :aria-label="`编辑 ${skill.name}`"
        @click="emit('command', 'edit')"
      >
        <el-icon><EditPen /></el-icon>
      </button>

      <el-switch
        class="row-switch"
        :model-value="!skill.disabled"
        :loading="busy"
        :disabled="busy"
        size="small"
        :title="skill.disabled ? '已停用，点击启用' : '已启用，点击停用'"
        @change="emit('toggle')"
      />

      <el-dropdown trigger="click" placement="bottom-end" @command="(command: SkillRowCommand) => emit('command', command)">
        <button class="icon-button" type="button" title="更多操作" aria-label="更多操作">
          <el-icon><MoreFilled /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="edit">编辑</el-dropdown-item>
            <el-dropdown-item command="open-directory">打开目录</el-dropdown-item>
            <el-dropdown-item command="copy-name">复制名称</el-dropdown-item>
            <el-dropdown-item command="copy-path">复制路径</el-dropdown-item>
            <el-dropdown-item class="danger-item" command="delete" divided>删除…</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped>
.skill-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease;
}

.skill-row:hover {
  background: var(--surface-hover);
}

.skill-row.is-active {
  background: var(--brand-soft);
}

.skill-row.is-active::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: var(--brand);
}

.skill-row.is-disabled .row-main {
  opacity: 0.5;
}

.row-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.row-title {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

/* 空间不够时优先压缩版本、作者、标签，名称尽量完整显示 */
.skill-name {
  flex: 0 0 auto;
  max-width: 62%;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.row-copy {
  width: 20px;
  height: 20px;
  opacity: 0;
}

.row-copy .el-icon {
  font-size: 13px;
}

.skill-row:hover .row-copy,
.row-copy:focus-visible {
  opacity: 1;
}

.spec-warning {
  flex: 0 0 auto;
  color: var(--warning);
  font-size: 14px;
}

.row-meta {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-size: 12px;
}

.row-meta--author {
  flex-shrink: 1;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-category,
.row-tag,
.scope-chip {
  flex: 0 0 auto;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
}

.row-category {
  background: var(--surface-muted);
  color: var(--text-soft);
}

.row-tag {
  max-width: 110px;
  overflow: hidden;
  padding: 0 2px;
  color: var(--text-faint);
  text-overflow: ellipsis;
}

.row-description {
  margin: 0;
  overflow: hidden;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-side {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  cursor: default;
}

.scope-chip {
  border: 1px solid var(--border-strong);
  color: var(--text-soft);
  line-height: 16px;
}

.row-edit {
  opacity: 0;
}

.skill-row:hover .row-edit,
.skill-row.is-active .row-edit,
.row-edit:focus-visible {
  opacity: 1;
}

.row-switch {
  margin: 0 2px 0 4px;
}

:global(.el-dropdown-menu__item.danger-item) {
  color: var(--danger);
}
</style>
