<script lang="ts" setup>
import { computed } from 'vue'
import { ArrowDown, Check, Folder } from '@element-plus/icons-vue'
import type { ProjectEntry } from '../useSettings'
import { compactDisplayPath } from '../utils'

const props = defineProps<{
  projects: ProjectEntry[]
}>()

const emit = defineEmits<{
  addProject: []
  manageProjects: []
}>()

const activeProjectId = defineModel<string>({ required: true })

type SwitcherCommand = { type: 'select', projectId: string } | { type: 'add' } | { type: 'manage' }

const activeProject = computed(() => props.projects.find((project) => project.id === activeProjectId.value) || null)

function handleCommand (command: SwitcherCommand) {
  if (command.type === 'select') activeProjectId.value = command.projectId
  if (command.type === 'add') emit('addProject')
  if (command.type === 'manage') emit('manageProjects')
}
</script>

<template>
  <el-dropdown trigger="click" placement="bottom-start" @command="handleCommand">
    <button
      :class="['project-switcher', { 'is-active': activeProject }]"
      type="button"
      :title="activeProject ? activeProject.path : '选择项目后会额外显示该项目里的 skill'"
    >
      <el-icon><Folder /></el-icon>
      <span>{{ activeProject ? activeProject.name : '未选择项目' }}</span>
      <el-icon class="switcher-arrow"><ArrowDown /></el-icon>
    </button>

    <template #dropdown>
      <div class="switcher-intro">
        选择项目后，会额外扫描该项目下的 .claude/skills、.agents/skills 等项目级目录
      </div>
      <el-dropdown-menu>
        <el-dropdown-item :command="{ type: 'select', projectId: '' }">
          <span class="switcher-check"><el-icon v-if="!activeProject"><Check /></el-icon></span>
          <span>不选择（只看全局 skill）</span>
        </el-dropdown-item>
        <el-dropdown-item
          v-for="project in projects"
          :key="project.id"
          :command="{ type: 'select', projectId: project.id }"
        >
          <span class="switcher-check"><el-icon v-if="project.id === activeProjectId"><Check /></el-icon></span>
          <span class="switcher-option">
            <span>{{ project.name }}</span>
            <span class="switcher-path">{{ compactDisplayPath(project.path) }}</span>
          </span>
        </el-dropdown-item>
        <el-dropdown-item :command="{ type: 'add' }" divided>
          <span class="switcher-check" />
          <span>添加项目…</span>
        </el-dropdown-item>
        <el-dropdown-item v-if="projects.length" :command="{ type: 'manage' }">
          <span class="switcher-check" />
          <span>管理项目</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.project-switcher {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  max-width: 200px;
  height: 20px;
  padding: 0 6px;
  border: 0;
  border-radius: var(--radius-small);
  background: transparent;
  color: var(--text-faint);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.project-switcher:hover {
  background: var(--surface-muted);
  color: var(--text);
}

.project-switcher.is-active {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}

.project-switcher > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switcher-arrow {
  font-size: 10px;
}

.switcher-intro {
  max-width: 260px;
  padding: 8px 14px 6px;
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.5;
}

.switcher-check {
  display: inline-flex;
  width: 16px;
  color: var(--brand);
}

.switcher-option {
  display: grid;
  line-height: 1.4;
}

.switcher-path {
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 11px;
}
</style>
