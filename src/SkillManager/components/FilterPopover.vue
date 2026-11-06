<script lang="ts" setup>
import { Filter } from '@element-plus/icons-vue'
import type { ScopeFilter, StatusFilter } from '../useSkillFilters'

defineProps<{
  categories: string[]
  activeCount: number
}>()

const emit = defineEmits<{
  reset: []
}>()

const status = defineModel<StatusFilter>('status', { required: true })
const scope = defineModel<ScopeFilter>('scope', { required: true })
const category = defineModel<string>('category', { required: true })
const specIssuesOnly = defineModel<boolean>('specIssuesOnly', { required: true })

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'enabled', label: '启用' },
  { value: 'disabled', label: '停用' }
]

const SCOPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'global', label: '用户目录' },
  { value: 'project', label: '项目' },
  { value: 'custom', label: '自定义' }
]
</script>

<template>
  <el-popover placement="bottom-end" trigger="click" :width="280" popper-class="filter-popper">
    <template #reference>
      <button class="icon-button filter-trigger" type="button" title="筛选" aria-label="筛选">
        <el-icon><Filter /></el-icon>
        <span v-if="activeCount > 0" class="filter-count">{{ activeCount }}</span>
      </button>
    </template>

    <div class="filter-panel">
      <div class="filter-field">
        <span class="filter-label">状态</span>
        <el-segmented v-model="status" :options="STATUS_OPTIONS" size="small" block />
      </div>

      <div class="filter-field">
        <span class="filter-label">范围</span>
        <el-segmented v-model="scope" :options="SCOPE_OPTIONS" size="small" block />
      </div>

      <div class="filter-field">
        <span class="filter-label">分类</span>
        <el-select
          v-model="category"
          :disabled="categories.length === 0"
          :placeholder="categories.length === 0 ? '暂无分类' : '全部分类'"
          :teleported="false"
          clearable
          size="small"
        >
          <el-option v-for="item in categories" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="filter-field filter-field--inline">
        <span class="filter-label">只看不符合规范的</span>
        <el-switch v-model="specIssuesOnly" size="small" />
      </div>

      <div class="filter-footer">
        <el-button :disabled="activeCount === 0" link size="small" type="primary" @click="emit('reset')">
          重置筛选
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.filter-trigger {
  position: relative;
}

.filter-count {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--brand);
  color: var(--surface);
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
}

.filter-panel {
  display: grid;
  gap: 12px;
}

.filter-field {
  display: grid;
  gap: 6px;
}

.filter-field--inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-label {
  color: var(--text-soft);
  font-size: 12px;
}

.filter-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
</style>
