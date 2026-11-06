<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { CopyDocument, EditPen, FolderOpened, Link, WarningFilled } from '@element-plus/icons-vue'
import AgentBadge from './AgentBadge.vue'
import { SHARED_AGENT_ID, getAgentName } from '../agents'
import { compactDisplayPath, copyText, getErrorMessage, openPath } from '../utils'
import type { Skill, SkillLocation } from '../types'

const props = defineProps<{
  skill: Skill | null
  // 对该 skill 可用的 agent（含 SHARED_AGENT_ID）
  agentIds: string[]
  busy: boolean
}>()

const emit = defineEmits<{
  toggle: []
  unlinkLocation: [location: SkillLocation]
  delete: []
  edit: []
}>()

const visible = defineModel<boolean>({ required: true })

const fileContent = ref('')
const fileError = ref('')

// 用户目录下的位置从路径（~/...）就能看出来，只给项目和自定义目录加说明
const SCOPE_LABELS: Record<string, string> = {
  global: '',
  project: '项目',
  custom: '自定义'
}

interface DetailField {
  label: string
  value: string
}

const detailFields = computed<DetailField[]>(() => {
  const skill = props.skill
  if (!skill) return []

  const fields: DetailField[] = [
    { label: '版本', value: skill.version },
    { label: '作者', value: skill.author },
    { label: '分类', value: skill.category },
    { label: '标签', value: skill.tags.join('、') },
    { label: 'License', value: skill.license },
    { label: '兼容性', value: skill.compatibility },
    { label: '允许的工具', value: skill.allowedTools.join(' ') }
  ]
  return fields.filter((field) => field.value)
})

const usableAgentNames = computed(() => props.agentIds
  .filter((agentId) => agentId !== SHARED_AGENT_ID)
  .map(getAgentName))

const hasRealDirectoryLocation = computed(() => props.skill?.locations.some((location) => !location.isSymlink) ?? false)

function loadFileContent (skill: Skill | null) {
  fileContent.value = ''
  fileError.value = ''
  if (!skill) return

  try {
    fileContent.value = window.services.readSkillFile({ skillFilePath: skill.skillFilePath })
  } catch (error) {
    fileError.value = getErrorMessage(error, '读取 SKILL.md 失败')
  }
}

watch(() => [visible.value, props.skill?.skillFilePath], () => {
  if (visible.value) loadFileContent(props.skill)
}, { immediate: true })
</script>

<template>
  <el-drawer v-model="visible" direction="rtl" size="78%" :with-header="true" class="skill-drawer">
    <template #header>
      <div v-if="skill" class="drawer-header">
        <div class="drawer-title">
          <h2 :title="skill.name">{{ skill.name }}</h2>
          <button class="icon-button" type="button" title="复制名称" @click="copyText(skill.name, '已复制名称')">
            <el-icon><CopyDocument /></el-icon>
          </button>
        </div>
        <el-button :icon="EditPen" size="small" type="primary" plain @click="emit('edit')">编辑</el-button>
        <el-switch
          :model-value="!skill.disabled"
          :loading="busy"
          :disabled="busy"
          active-text="启用"
          inactive-text="停用"
          inline-prompt
          @change="emit('toggle')"
        />
      </div>
    </template>

    <div v-if="skill" class="drawer-body">
      <p class="drawer-description">{{ skill.description }}</p>

      <div v-if="skill.specIssues.length" class="spec-panel">
        <div class="spec-panel-title">
          <el-icon><WarningFilled /></el-icon>
          <span>不符合 Agent Skills 规范</span>
        </div>
        <ul>
          <li v-for="issue in skill.specIssues" :key="issue">{{ issue }}</li>
        </ul>
      </div>

      <dl v-if="detailFields.length" class="detail-grid">
        <template v-for="field in detailFields" :key="field.label">
          <dt>{{ field.label }}</dt>
          <dd>{{ field.value }}</dd>
        </template>
      </dl>

      <section class="drawer-section">
        <h3>可用于</h3>
        <p class="usable-agents">{{ usableAgentNames.length ? usableAgentNames.join('、') : '没有已启用的 agent 会读取这个 skill' }}</p>
      </section>

      <section class="drawer-section">
        <h3>安装位置</h3>
        <ul class="location-list">
          <li v-for="location in skill.locations" :key="location.entryPath" class="location-item">
            <AgentBadge :agent-id="location.agentId" />
            <span v-if="SCOPE_LABELS[location.scope]" class="location-scope">{{ SCOPE_LABELS[location.scope] }}</span>
            <span class="location-path" :title="location.entryPath">{{ compactDisplayPath(location.entryPath) }}</span>
            <el-tooltip v-if="location.isSymlink" :content="`软链接 → ${compactDisplayPath(skill.realPath)}`" placement="top">
              <el-icon class="location-link"><Link /></el-icon>
            </el-tooltip>
            <div class="location-actions">
              <button class="icon-button" type="button" title="打开目录" @click="openPath(location.entryPath)">
                <el-icon><FolderOpened /></el-icon>
              </button>
              <el-button
                v-if="location.isSymlink"
                :disabled="busy"
                link
                size="small"
                type="danger"
                @click="emit('unlinkLocation', location)"
              >
                解除链接
              </el-button>
            </div>
          </li>
        </ul>
        <p v-if="!hasRealDirectoryLocation" class="location-note">
          以上都是软链接，链接指向的目录不在扫描范围内，删除时会保留
        </p>
      </section>

      <section class="drawer-section drawer-section--file">
        <div class="file-header">
          <h3>{{ skill.disabled ? 'SKILL.md.disabled' : 'SKILL.md' }}</h3>
          <el-button link size="small" type="primary" @click="emit('edit')">
            <el-icon><EditPen /></el-icon>
            <span>编辑</span>
          </el-button>
        </div>
        <p v-if="fileError" class="location-note">{{ fileError }}</p>
        <!-- 只展示原文，不渲染 Markdown/HTML：页面带有 Node 能力，第三方 skill 内容不能被当作 HTML 执行 -->
        <pre v-else class="file-preview">{{ fileContent }}</pre>
      </section>

      <div class="drawer-footer">
        <el-button :disabled="busy" plain size="small" type="danger" @click="emit('delete')">删除 skill</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.drawer-header > .el-button {
  margin-left: auto;
}

.drawer-title {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.drawer-title h2 {
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-body {
  display: grid;
  gap: 16px;
  padding: 4px 16px 16px;
}

.drawer-description {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.6;
  white-space: pre-wrap;
}

.spec-panel {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  font-size: 12px;
}

.spec-panel-title {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--warning);
  font-weight: 600;
}

.spec-panel ul {
  margin: 6px 0 0;
  padding-left: 20px;
  color: var(--text-soft);
}

.detail-grid {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  font-size: 12px;
}

.detail-grid dt {
  color: var(--text-faint);
}

.detail-grid dd {
  margin: 0;
  word-break: break-word;
}

.drawer-section {
  display: grid;
  gap: 8px;
}

.drawer-section h3 {
  margin: 0;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 500;
}

.usable-agents {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.location-list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.location-item {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 4px 6px;
  border-radius: var(--radius-small);
}

.location-item:hover {
  background: var(--surface-hover);
}

.location-scope {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-size: 11px;
}

.location-path {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-link {
  flex: 0 0 auto;
  color: var(--text-faint);
}

.location-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
}

.location-note {
  margin: 0;
  color: var(--text-faint);
  font-size: 12px;
}

.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-header .el-button .el-icon {
  margin-right: 4px;
}

.file-preview {
  max-height: 360px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
</style>
