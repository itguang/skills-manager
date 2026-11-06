<script lang="ts" setup>
import { Close, Plus } from '@element-plus/icons-vue'
import { AGENT_PRESETS } from '../agents'
import { useSettings } from '../useSettings'
import { pickDirectory } from '../utils'
import PathInput from './PathInput.vue'
import SourceStatus from './SourceStatus.vue'
import type { ScannedSource } from '../types'

defineProps<{
  scannedSourcesById: Map<string, ScannedSource>
}>()

const { settings, addCustomSource, removeCustomSource } = useSettings()

function handleAddSource () {
  const selectedPath = pickDirectory('选择 skill 目录')
  if (selectedPath) addCustomSource(selectedPath)
}
</script>

<template>
  <section class="settings-section">
    <header class="section-header">
      <div>
        <h3>自定义目录</h3>
        <p>其它工具或个人收藏的 skill 目录，可选关联到某个 agent</p>
      </div>
      <el-button :icon="Plus" size="small" @click="handleAddSource">添加目录</el-button>
    </header>

    <p v-if="settings.customSources.length === 0" class="section-empty">暂无自定义目录</p>

    <ul v-else class="section-rows">
      <li v-for="source in settings.customSources" :key="source.id" class="custom-row">
        <el-input v-model="source.label" class="custom-label" size="small" placeholder="名称" />
        <PathInput v-model="source.path" class="custom-path" dialog-title="选择 skill 目录" placeholder="目录路径" />
        <el-select v-model="source.agentId" class="custom-agent" size="small" placeholder="不关联">
          <el-option label="不关联" value="" />
          <el-option v-for="preset in AGENT_PRESETS" :key="preset.id" :label="preset.name" :value="preset.id" />
        </el-select>
        <SourceStatus :source="scannedSourcesById.get(source.id)" />
        <button class="icon-button" type="button" title="移除目录" @click="removeCustomSource(source.id)">
          <el-icon><Close /></el-icon>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.custom-row {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.custom-label {
  flex: 0 0 120px;
}

.custom-path {
  flex: 1 1 auto;
  min-width: 0;
}

.custom-agent {
  flex: 0 0 120px;
}
</style>
