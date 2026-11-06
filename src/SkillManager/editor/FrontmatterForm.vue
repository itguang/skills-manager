<script lang="ts" setup>
import { computed } from 'vue'
import type { FrontmatterFields } from './frontmatter'

const props = defineProps<{
  directoryName: string
  specIssues: string[]
  parseError: string
}>()

const fields = defineModel<FrontmatterFields>({ required: true })

const DESCRIPTION_MAX_LENGTH = 1024

function updateField<K extends keyof FrontmatterFields> (key: K, value: FrontmatterFields[K]) {
  fields.value = { ...fields.value, [key]: value }
}

const descriptionLength = computed(() => fields.value.description.trim().length)
const nameMismatch = computed(() => Boolean(fields.value.name) && fields.value.name !== props.directoryName)
</script>

<template>
  <div class="frontmatter-form">
    <div v-if="parseError" class="form-alert">
      frontmatter 无法解析：{{ parseError }}。请切换到「源码」模式修正后再使用表单。
    </div>

    <template v-else>
      <div class="form-row">
        <label class="form-label" for="fm-name">name</label>
        <div class="form-control">
          <el-input
            id="fm-name"
            :model-value="fields.name"
            size="small"
            placeholder="小写字母、数字和连字符，需与目录名一致"
            @update:model-value="(value: string) => updateField('name', value)"
          />
          <el-button
            v-if="nameMismatch"
            link
            size="small"
            type="primary"
            @click="updateField('name', directoryName)"
          >
            改为目录名 {{ directoryName }}
          </el-button>
        </div>
      </div>

      <div class="form-row">
        <label class="form-label" for="fm-description">description</label>
        <div class="form-control form-control--stack">
          <el-input
            id="fm-description"
            :model-value="fields.description"
            :autosize="{ minRows: 2, maxRows: 6 }"
            placeholder="说明这个 skill 做什么、什么时候使用，agent 依靠它决定是否加载"
            size="small"
            type="textarea"
            @update:model-value="(value: string) => updateField('description', value)"
          />
          <span :class="['char-count', { 'is-over': descriptionLength > DESCRIPTION_MAX_LENGTH }]">
            {{ descriptionLength }} / {{ DESCRIPTION_MAX_LENGTH }}
          </span>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-row">
          <label class="form-label" for="fm-version">版本</label>
          <el-input
            id="fm-version"
            :model-value="fields.version"
            size="small"
            placeholder="1.0.0"
            @update:model-value="(value: string) => updateField('version', value)"
          />
        </div>
        <div class="form-row">
          <label class="form-label" for="fm-author">作者</label>
          <el-input
            id="fm-author"
            :model-value="fields.author"
            size="small"
            @update:model-value="(value: string) => updateField('author', value)"
          />
        </div>
        <div class="form-row">
          <label class="form-label" for="fm-category">分类</label>
          <el-input
            id="fm-category"
            :model-value="fields.category"
            size="small"
            @update:model-value="(value: string) => updateField('category', value)"
          />
        </div>
        <div class="form-row">
          <label class="form-label" for="fm-license">License</label>
          <el-input
            id="fm-license"
            :model-value="fields.license"
            size="small"
            placeholder="如 MIT"
            @update:model-value="(value: string) => updateField('license', value)"
          />
        </div>
      </div>

      <div class="form-row">
        <span class="form-label">标签</span>
        <el-input-tag
          :model-value="fields.tags"
          size="small"
          placeholder="输入后按回车添加"
          @update:model-value="(value: string[] | undefined) => updateField('tags', value || [])"
        />
      </div>

      <div class="form-row">
        <label class="form-label" for="fm-tools">allowed-tools</label>
        <el-input
          id="fm-tools"
          :model-value="fields.allowedTools"
          size="small"
          placeholder="空格分隔，如 Bash(git:*) Read"
          @update:model-value="(value: string) => updateField('allowedTools', value)"
        />
      </div>

      <div class="form-row">
        <label class="form-label" for="fm-compat">兼容性</label>
        <el-input
          id="fm-compat"
          :model-value="fields.compatibility"
          size="small"
          placeholder="运行环境要求，如需要 git、docker、网络"
          @update:model-value="(value: string) => updateField('compatibility', value)"
        />
      </div>

      <ul v-if="specIssues.length" class="form-issues">
        <li v-for="issue in specIssues" :key="issue">{{ issue }}</li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.frontmatter-form {
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.form-label {
  padding-top: 4px;
  color: var(--text-soft);
  font-family: var(--font-mono);
  font-size: 12px;
}

.form-control {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.form-control--stack {
  display: grid;
  gap: 2px;
}

.char-count {
  justify-self: end;
  color: var(--text-faint);
  font-size: 11px;
}

.char-count.is-over {
  color: var(--danger);
}

.form-alert,
.form-issues {
  margin: 0;
  color: var(--warning);
  font-size: 12px;
}

.form-issues {
  padding-left: 18px;
}

.frontmatter-form :deep(.el-input__wrapper),
.frontmatter-form :deep(.el-textarea__inner),
.frontmatter-form :deep(.el-input-tag__wrapper) {
  background: var(--surface);
}
</style>
