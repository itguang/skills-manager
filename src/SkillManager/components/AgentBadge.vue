<script lang="ts" setup>
import { computed } from 'vue'
import AgentIcon from './AgentIcon.vue'
import { getAgentColorVariable, getAgentIcon, getAgentName, getAgentShortName } from '../agents'

const props = defineProps<{
  agentId: string
}>()

const badgeStyle = computed(() => ({ '--badge-color': getAgentColorVariable(props.agentId) }))
</script>

<template>
  <span v-if="getAgentIcon(agentId)" class="agent-badge agent-badge--icon" :title="getAgentName(agentId)">
    <AgentIcon :agent-id="agentId" :show-title="false" :size="14" />
    <span>{{ getAgentShortName(agentId) }}</span>
  </span>
  <span v-else class="agent-badge" :style="badgeStyle" :title="getAgentName(agentId)">
    {{ getAgentShortName(agentId) }}
  </span>
</template>

<style scoped>
.agent-badge {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--badge-color) 13%, transparent);
  color: var(--badge-color);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.agent-badge--icon {
  gap: 5px;
  padding: 0;
  background: transparent;
  color: var(--text);
  font-weight: 500;
}
</style>
