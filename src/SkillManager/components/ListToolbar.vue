<script lang="ts" setup>
import { Refresh, Setting } from '@element-plus/icons-vue'
import AgentIcon from './AgentIcon.vue'
import { getAgentColorVariable, getAgentIcon, getAgentName } from '../agents'

export interface AgentTab {
  id: string
  label: string
  count: number
}

defineProps<{
  agentTabs: AgentTab[]
  isLoading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  openSettings: []
}>()

const activeAgentId = defineModel<string>('activeAgentId', { required: true })
</script>

<template>
  <div class="list-toolbar">
    <div class="agent-tabs" role="tablist">
      <button
        v-for="tab in agentTabs"
        :key="tab.id"
        :class="['agent-tab', { 'is-active': tab.id === activeAgentId }]"
        :style="{ '--tab-color': tab.id === 'all' ? 'var(--brand)' : getAgentColorVariable(tab.id) }"
        :aria-selected="tab.id === activeAgentId"
        role="tab"
        :title="getAgentIcon(tab.id) ? getAgentName(tab.id) : undefined"
        type="button"
        @click="activeAgentId = tab.id"
      >
        <!-- 有官方图标的 agent 只显示图标以节省空间，名称放在 title 里 -->
        <AgentIcon v-if="getAgentIcon(tab.id)" :agent-id="tab.id" :show-title="false" :size="14" />
        <span v-else>{{ tab.label }}</span>
        <span class="agent-tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <div class="toolbar-actions">
      <slot name="filters" />
      <button
        :class="['icon-button', { 'is-spinning': isLoading }]"
        :disabled="isLoading"
        type="button"
        title="重新扫描"
        aria-label="重新扫描"
        @click="emit('refresh')"
      >
        <el-icon><Refresh /></el-icon>
      </button>
      <button class="icon-button" type="button" title="目录配置" aria-label="目录配置" @click="emit('openSettings')">
        <el-icon><Setting /></el-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.agent-tabs {
  display: flex;
  flex: 1 1 auto;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.agent-tabs::-webkit-scrollbar {
  display: none;
}

.agent-tab {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 5px;
  align-items: center;
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-soft);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.agent-tab:hover {
  background: var(--surface-muted);
  color: var(--text);
}

.agent-tab.is-active {
  background: color-mix(in srgb, var(--tab-color) 14%, transparent);
  color: var(--tab-color);
  font-weight: 600;
}

.agent-tab-count {
  color: var(--text-faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.agent-tab.is-active .agent-tab-count {
  color: inherit;
  opacity: 0.75;
}

.toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
  align-items: center;
  margin-left: auto;
}

.is-spinning .el-icon {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
