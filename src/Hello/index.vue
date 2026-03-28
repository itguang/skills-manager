<script lang="ts" setup>
defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="hello-page">
    <el-card class="hello-card" shadow="never">
      <template #header>
        <div class="hello-header">
          <div>
            <h1>你好，Hello</h1>
            <p>插件应用进入参数</p>
          </div>
          <el-tag effect="plain" type="primary">调试视图</el-tag>
        </div>
      </template>

      <pre>{{ JSON.stringify(enterAction, undefined, 2) }}</pre>
    </el-card>
  </div>
</template>

<style scoped>
.hello-page {
  height: 100%;
  padding: 18px;
}

.hello-card {
  height: 100%;
}

.hello-card :deep(.el-card__body) {
  height: calc(100% - 48px);
  overflow: auto;
}

.hello-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.hello-header h1,
.hello-header p {
  margin: 0;
}

.hello-header h1 {
  font-size: 24px;
}

.hello-header p {
  margin-top: 6px;
  color: var(--text-soft);
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
