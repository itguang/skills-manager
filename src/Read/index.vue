<script lang="ts" setup>
import { ref, watch } from 'vue'

const props = defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})

const filePath = ref('')
const fileContent = ref('')
const error = ref('')

function loadFile (targetPath: string) {
  filePath.value = targetPath

  try {
    error.value = ''
    fileContent.value = window.services.readFile(targetPath)
  } catch (err: any) {
    error.value = err?.message || '读取文件失败'
    fileContent.value = ''
  }
}

function handleOpenDialog () {
  const files = window.utools.showOpenDialog({
    title: '选择文件',
    properties: ['openFile']
  })

  if (!files || files.length === 0) return

  loadFile(files[0])
}

watch(() => props.enterAction, (enterAction: any) => {
  if (enterAction?.type === 'files' && enterAction?.payload?.[0]?.path) {
    loadFile(enterAction.payload[0].path)
  }
}, {
  immediate: true
})
</script>

<template>
  <div class="read-page">
    <section class="read-shell">
      <div class="read-actions">
        <el-button type="primary" @click="handleOpenDialog">选择文件</el-button>
        <span v-if="filePath" class="read-file">{{ filePath }}</span>
      </div>

      <el-alert
        v-if="error"
        :closable="false"
        :title="error"
        show-icon
        type="error"
      />

      <el-empty
        v-else-if="!fileContent"
        description="选择一个文件后在这里查看内容"
      />

      <el-card v-else class="read-content-card" shadow="never">
        <pre>{{ fileContent }}</pre>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.read-page {
  height: 100%;
  padding: 20px;
}

.read-shell {
  display: grid;
  gap: 16px;
  height: 100%;
}

.read-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.read-file {
  min-width: 0;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.read-content-card {
  min-height: 0;
}

.read-content-card :deep(.el-card__body) {
  max-height: calc(100vh - 180px);
  overflow: auto;
}

pre {
  margin: 0;
  white-space: break-spaces;
  word-break: break-word;
}
</style>
