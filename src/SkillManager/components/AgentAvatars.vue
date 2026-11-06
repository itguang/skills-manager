<script lang="ts" setup>
import { computed } from 'vue'
import AgentIcon from './AgentIcon.vue'
import { getAgentName } from '../agents'

const props = defineProps<{
  agentIds: string[]
}>()

const tooltipText = computed(() => `可用于：${props.agentIds.map(getAgentName).join('、')}`)
</script>

<template>
  <el-tooltip v-if="agentIds.length" :content="tooltipText" placement="top" :show-after="200">
    <span class="agent-avatars">
      <AgentIcon v-for="agentId in agentIds" :key="agentId" :agent-id="agentId" :show-title="false" :size="15" />
    </span>
  </el-tooltip>
</template>

<style scoped>
.agent-avatars {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  color: var(--text);
}
</style>
