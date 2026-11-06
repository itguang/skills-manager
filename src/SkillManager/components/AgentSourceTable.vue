<script lang="ts" setup>
import AgentIcon from './AgentIcon.vue'
import { AGENT_PRESETS, SHARED_AGENT_ID } from '../agents'
import { useSettings } from '../useSettings'
import PathInput from './PathInput.vue'
import SourceStatus from './SourceStatus.vue'
import type { ScannedSource } from '../types'

defineProps<{
  scannedSourcesById: Map<string, ScannedSource>
}>()

const emit = defineEmits<{
  reset: []
}>()

const { settings } = useSettings()
</script>

<template>
  <section class="settings-section">
    <header class="section-header">
      <div>
        <h3>Agent 目录</h3>
        <p>用户目录支持 ~ 和环境变量（如 ${CODEX_HOME}），项目目录相对项目根目录。勾选「读取全局」的 agent 也能使用全局目录里的 skill</p>
      </div>
      <el-button link size="small" type="primary" @click="emit('reset')">恢复默认路径</el-button>
    </header>

    <ul class="section-rows">
      <li
        v-for="preset in AGENT_PRESETS"
        :key="preset.id"
        :class="['agent-row', { 'is-off': !settings.agents[preset.id].enabled }]"
      >
        <div class="agent-identity">
          <el-switch v-model="settings.agents[preset.id].enabled" size="small" />
          <AgentIcon class="agent-logo" :agent-id="preset.id" :show-title="false" :size="16" />
          <div class="agent-label">
            <span class="agent-name">{{ preset.name }}</span>
            <span v-if="preset.id === SHARED_AGENT_ID" class="agent-hint">Agent Skills 规范目录</span>
            <el-checkbox
              v-else
              v-model="settings.agents[preset.id].readsShared"
              :disabled="!settings.agents[preset.id].enabled"
              class="agent-reads-shared"
              size="small"
            >
              读取全局
            </el-checkbox>
          </div>
        </div>

        <div class="agent-paths">
          <div class="path-line">
            <span class="path-scope">用户</span>
            <PathInput
              v-model="settings.agents[preset.id].globalPath"
              :dialog-title="`选择 ${preset.name} 全局 skill 目录`"
              :disabled="!settings.agents[preset.id].enabled"
              :placeholder="preset.globalPath"
            />
            <SourceStatus :source="scannedSourcesById.get(`${preset.id}:global`)" />
          </div>
          <div class="path-line">
            <span class="path-scope">项目</span>
            <PathInput
              v-model="settings.agents[preset.id].projectPath"
              :dialog-title="`选择 ${preset.name} 项目 skill 目录`"
              :disabled="!settings.agents[preset.id].enabled"
              :placeholder="preset.projectPath"
            />
            <SourceStatus :source="scannedSourcesById.get(`${preset.id}:project`)" />
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.agent-row {
  display: grid;
  grid-template-columns: 186px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 6px 0;
  border-top: 1px solid var(--border);
}

.agent-row:first-child {
  border-top: 0;
}

.agent-identity {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding-top: 4px;
}

.agent-identity > .el-switch,
.agent-logo {
  margin-top: 1px;
}

.agent-logo {
  color: var(--text);
}

.agent-label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.agent-hint {
  color: var(--text-faint);
  font-size: 11px;
}

.agent-reads-shared {
  height: 18px;
}

.agent-reads-shared :deep(.el-checkbox__label) {
  padding-left: 4px;
  color: var(--text-soft);
  font-size: 11px;
}

.agent-name {
  font-weight: 600;
  white-space: nowrap;
}

.agent-row.is-off .agent-name,
.agent-row.is-off .agent-paths {
  opacity: 0.45;
}

.agent-paths {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.path-line {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.path-scope {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-size: 11px;
}

.path-line .path-input {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
