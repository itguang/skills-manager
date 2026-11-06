<script lang="ts" setup>
import { computed } from 'vue'
import { Back, Refresh } from '@element-plus/icons-vue'
import AgentSourceTable from './AgentSourceTable.vue'
import CustomSourceList from './CustomSourceList.vue'
import ProjectList from './ProjectList.vue'
import { useSettings } from '../useSettings'
import { compactDisplayPath } from '../utils'
import type { ScanProblem, ScannedSource } from '../types'

const props = defineProps<{
  scannedSources: ScannedSource[]
  problems: ScanProblem[]
  isLoading: boolean
}>()

const emit = defineEmits<{
  back: []
  rescan: []
  cleanBrokenLinks: []
}>()

const { resetAgentDefaults } = useSettings()

const scannedSourcesById = computed(() => new Map(props.scannedSources.map((source) => [source.id, source])))
const brokenLinks = computed(() => props.problems.filter((problem) => problem.kind === 'broken-link'))
const readErrors = computed(() => props.problems.filter((problem) => problem.kind === 'read-error'))
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <button class="icon-button" type="button" title="返回列表" aria-label="返回列表" @click="emit('back')">
        <el-icon><Back /></el-icon>
      </button>
      <h2>目录配置</h2>
      <span class="settings-hint">修改自动保存并重新扫描</span>
      <button
        :class="['icon-button', 'settings-rescan', { 'is-spinning': isLoading }]"
        :disabled="isLoading"
        type="button"
        title="重新扫描"
        @click="emit('rescan')"
      >
        <el-icon><Refresh /></el-icon>
      </button>
    </header>

    <el-scrollbar class="settings-scroll">
      <div class="settings-content">
        <ProjectList />
        <AgentSourceTable :scanned-sources-by-id="scannedSourcesById" @reset="resetAgentDefaults" />
        <CustomSourceList :scanned-sources-by-id="scannedSourcesById" />

        <section v-if="problems.length" class="settings-section">
          <header class="section-header">
            <div>
              <h3>扫描问题</h3>
              <p>失效的软链接指向的目录已不存在，可以安全清理</p>
            </div>
            <el-button
              v-if="brokenLinks.length"
              plain
              size="small"
              type="danger"
              @click="emit('cleanBrokenLinks')"
            >
              清理 {{ brokenLinks.length }} 个失效链接
            </el-button>
          </header>
          <ul class="section-rows problem-list">
            <li v-for="problem in [...brokenLinks, ...readErrors]" :key="problem.entryPath" class="problem-row">
              <span class="problem-path" :title="problem.entryPath">{{ compactDisplayPath(problem.entryPath) }}</span>
              <span class="problem-reason">{{ problem.reason }}</span>
            </li>
          </ul>
        </section>
      </div>
    </el-scrollbar>
  </div>
</template>

<style src="./settings-section.css"></style>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.settings-header {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.settings-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.settings-hint {
  color: var(--text-faint);
  font-size: 12px;
}

.settings-rescan {
  margin-left: auto;
}

.settings-scroll {
  flex: 1;
  min-height: 0;
}

.settings-content {
  display: grid;
  gap: 12px;
  padding: 12px 14px 16px;
}

.settings-content > * {
  animation: section-in 0.24s ease both;
}

.settings-content > *:nth-child(2) {
  animation-delay: 0.04s;
}

.settings-content > *:nth-child(3) {
  animation-delay: 0.08s;
}

.settings-content > *:nth-child(4) {
  animation-delay: 0.12s;
}

.problem-list {
  max-height: 160px;
  overflow: auto;
}

.problem-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  font-size: 12px;
}

.problem-path {
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.problem-reason {
  flex: 0 0 auto;
  color: var(--text-faint);
}

.is-spinning .el-icon {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes section-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
