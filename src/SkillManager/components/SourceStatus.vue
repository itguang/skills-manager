<script lang="ts" setup>
import { computed } from 'vue'
import type { ScannedSource } from '../types'

const props = defineProps<{
  source?: ScannedSource
}>()

type StatusTone = 'ok' | 'empty' | 'idle' | 'error'

// 「目录不存在」「未选择项目」属于正常情况，用灰色；其它原因才算错误
const IDLE_REASONS = new Set(['目录不存在', '未选择项目', '未配置目录'])

const status = computed<{ tone: StatusTone, text: string }>(() => {
  const source = props.source
  if (!source) return { tone: 'idle', text: '未扫描' }
  if (source.exists) {
    return { tone: source.totalSkills > 0 ? 'ok' : 'empty', text: `${source.totalSkills} 个` }
  }
  return { tone: IDLE_REASONS.has(source.reason) ? 'idle' : 'error', text: source.reason || '未扫描' }
})
</script>

<template>
  <span :class="['source-status', `is-${status.tone}`]" :title="source?.resolvedPath || status.text">
    <span class="status-dot" />
    <span class="status-text">{{ status.text }}</span>
  </span>
</template>

<style scoped>
.source-status {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  min-width: 76px;
  color: var(--text-faint);
  font-size: 12px;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-strong);
}

.is-ok {
  color: var(--text-soft);
}

.is-ok .status-dot {
  background: var(--success);
}

.is-empty .status-dot {
  background: var(--text-faint);
}

.is-error {
  color: var(--danger);
}

.is-error .status-dot {
  background: var(--danger);
}
</style>
