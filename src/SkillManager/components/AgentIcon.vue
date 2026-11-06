<script lang="ts" setup>
import { computed } from 'vue'
import { getAgentColorVariable, getAgentIcon, getAgentMonogram, getAgentName } from '../agents'

const props = withDefaults(defineProps<{
  agentId: string
  size?: number
  // 由外层统一提供提示（例如 tooltip）时关闭自带的 title
  showTitle?: boolean
}>(), {
  size: 16,
  showTitle: true
})

const icon = computed(() => getAgentIcon(props.agentId))
const title = computed(() => (props.showTitle ? getAgentName(props.agentId) : undefined))
const sizeStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
// 小图标会被 Vite 内联成 data URI，里面有空格和单引号，必须加双引号包起来才能被 CSS 正确解析
const maskUrl = computed(() => (icon.value ? `url("${icon.value.url}")` : 'none'))
</script>

<template>
  <img
    v-if="icon && !icon.monochrome"
    class="agent-icon"
    :alt="getAgentName(agentId)"
    :src="icon.url"
    :style="sizeStyle"
    :title="title"
    draggable="false"
  >
  <span
    v-else-if="icon"
    class="agent-icon agent-icon--mono"
    :aria-label="getAgentName(agentId)"
    :style="{ ...sizeStyle, maskImage: maskUrl, WebkitMaskImage: maskUrl }"
    :title="title"
    role="img"
  />
  <span
    v-else
    class="agent-icon agent-icon--monogram"
    :style="{ ...sizeStyle, '--monogram-color': getAgentColorVariable(agentId), fontSize: `${Math.round(size * 0.55)}px` }"
    :title="title"
  >
    {{ getAgentMonogram(agentId) }}
  </span>
</template>

<style scoped>
.agent-icon {
  display: inline-block;
  flex: 0 0 auto;
}

.agent-icon--mono {
  background: currentColor;
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}

.agent-icon--monogram {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: color-mix(in srgb, var(--monogram-color) 15%, transparent);
  color: var(--monogram-color);
  font-weight: 700;
  line-height: 1;
}
</style>
