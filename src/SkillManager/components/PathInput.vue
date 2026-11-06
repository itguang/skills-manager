<script lang="ts" setup>
import { FolderOpened } from '@element-plus/icons-vue'
import { pickDirectory } from '../utils'

const props = defineProps<{
  placeholder?: string
  dialogTitle: string
  disabled?: boolean
}>()

const path = defineModel<string>({ required: true })

function browse () {
  const selectedPath = pickDirectory(props.dialogTitle)
  if (selectedPath) path.value = selectedPath
}
</script>

<template>
  <el-input
    v-model="path"
    class="path-input"
    :disabled="disabled"
    :placeholder="placeholder"
    size="small"
    spellcheck="false"
  >
    <template #suffix>
      <button class="icon-button path-browse" :disabled="disabled" type="button" title="选择目录" @click="browse">
        <el-icon><FolderOpened /></el-icon>
      </button>
    </template>
  </el-input>
</template>

<style scoped>
.path-input :deep(.el-input__wrapper) {
  padding-right: 2px;
  background: transparent;
  box-shadow: none;
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
}

.path-input:hover :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--border) inset;
}

.path-input :deep(.el-input__wrapper.is-focus) {
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--brand) inset;
}

.path-input :deep(.el-input__inner) {
  font-family: var(--font-mono);
  font-size: 12px;
}

.path-browse {
  width: 22px;
  height: 22px;
}
</style>
