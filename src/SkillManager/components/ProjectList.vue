<script lang="ts" setup>
import { Check, Close, FolderOpened, Plus } from '@element-plus/icons-vue'
import { useSettings } from '../useSettings'
import { compactDisplayPath, openPath, pickDirectory } from '../utils'

const { settings, addProject, removeProject } = useSettings()

function handleAddProject () {
  const selectedPath = pickDirectory('选择项目根目录')
  if (selectedPath) addProject(selectedPath)
}
</script>

<template>
  <section class="settings-section">
    <header class="section-header">
      <div>
        <h3>项目</h3>
        <p>项目级 skill 目录（如 .claude/skills）会相对当前选中的项目解析</p>
      </div>
      <el-button :icon="Plus" size="small" @click="handleAddProject">添加项目</el-button>
    </header>

    <p v-if="settings.projects.length === 0" class="section-empty">还没有添加项目，目前只扫描全局目录</p>

    <ul v-else class="section-rows">
      <li
        v-for="project in settings.projects"
        :key="project.id"
        :class="['project-row', { 'is-active': project.id === settings.activeProjectId }]"
      >
        <button
          class="project-pick"
          type="button"
          :title="project.id === settings.activeProjectId ? '当前项目' : '设为当前项目'"
          @click="settings.activeProjectId = project.id"
        >
          <el-icon v-if="project.id === settings.activeProjectId"><Check /></el-icon>
        </button>
        <el-input v-model="project.name" class="project-name" size="small" placeholder="项目名称" />
        <span class="project-path" :title="project.path">{{ compactDisplayPath(project.path) }}</span>
        <button class="icon-button" type="button" title="打开目录" @click="openPath(project.path)">
          <el-icon><FolderOpened /></el-icon>
        </button>
        <button class="icon-button" type="button" title="移除项目" @click="removeProject(project.id)">
          <el-icon><Close /></el-icon>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.project-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 6px;
  border-radius: var(--radius-small);
}

.project-row:hover {
  background: var(--surface-hover);
}

.project-pick {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: transparent;
  color: var(--surface);
  font-size: 10px;
  cursor: pointer;
}

.project-row.is-active .project-pick {
  border-color: var(--brand);
  background: var(--brand);
}

.project-name {
  flex: 0 0 160px;
}

.project-name :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
}

.project-name :deep(.el-input__wrapper:hover),
.project-name :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--border) inset;
}

.project-name :deep(.el-input__inner) {
  font-weight: 600;
}

.project-path {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--text-soft);
  font-family: var(--font-mono);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
