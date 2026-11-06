<script lang="ts" setup>
import { ref } from 'vue'
import { ArrowRight, Document, Folder } from '@element-plus/icons-vue'

export interface FileTreeNode {
  type: 'file' | 'directory'
  name: string
  path: string
  size?: number
  children?: FileTreeNode[]
}

defineProps<{
  nodes: FileTreeNode[]
  activePath: string
  dirtyPaths: Set<string>
  depth?: number
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

// 默认展开 references / scripts 这类一级目录，大部分 skill 只有一两层
const collapsedPaths = ref(new Set<string>())

function toggleDirectory (path: string) {
  const next = new Set(collapsedPaths.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  collapsedPaths.value = next
}
</script>

<template>
  <ul class="file-tree">
    <li v-for="node in nodes" :key="node.path">
      <button
        v-if="node.type === 'directory'"
        class="tree-item tree-item--directory"
        :style="{ paddingLeft: `${8 + (depth || 0) * 12}px` }"
        type="button"
        @click="toggleDirectory(node.path)"
      >
        <el-icon :class="['tree-arrow', { 'is-open': !collapsedPaths.has(node.path) }]"><ArrowRight /></el-icon>
        <el-icon><Folder /></el-icon>
        <span class="tree-name">{{ node.name }}</span>
      </button>
      <button
        v-else
        :class="['tree-item', { 'is-active': node.path === activePath }]"
        :style="{ paddingLeft: `${20 + (depth || 0) * 12}px` }"
        :title="node.path"
        type="button"
        @click="emit('select', node.path)"
      >
        <el-icon><Document /></el-icon>
        <span class="tree-name">{{ node.name }}</span>
        <span v-if="dirtyPaths.has(node.path)" class="tree-dirty" title="未保存" />
      </button>

      <FileTree
        v-if="node.type === 'directory' && node.children?.length && !collapsedPaths.has(node.path)"
        :active-path="activePath"
        :depth="(depth || 0) + 1"
        :dirty-paths="dirtyPaths"
        :nodes="node.children"
        @select="(path: string) => emit('select', path)"
      />
    </li>
  </ul>
</template>

<style scoped>
.file-tree {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tree-item {
  display: flex;
  gap: 5px;
  align-items: center;
  width: 100%;
  height: 26px;
  padding-right: 8px;
  border: 0;
  border-radius: var(--radius-small);
  background: transparent;
  color: var(--text-soft);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.tree-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.tree-item.is-active {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}

.tree-item .el-icon {
  flex: 0 0 auto;
  font-size: 13px;
}

.tree-arrow {
  font-size: 10px !important;
  transition: transform 0.15s ease;
}

.tree-arrow.is-open {
  transform: rotate(90deg);
}

.tree-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-dirty {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--warning);
}
</style>
