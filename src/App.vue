<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import SkillManager from './SkillManager/index.vue'
import SkillPackage from './SkillPackage/index.vue'
import { STORAGE_KEYS } from './storageKeys.js'

const enterAction = ref({})
const windowType = ref<'main' | 'detach' | 'browser'>('main')
const activeSkillPackage = ref<any>(null)

const shouldRenderSkillPackage = computed(() => {
  return windowType.value === 'browser'
})

function getStoredSkillPackage () {
  try {
    const value = window.utools.dbStorage.getItem(STORAGE_KEYS.activeSkillPackage)
    return value && typeof value === 'object' ? value : null
  } catch (error) {
    return null
  }
}

function closeSkillPackageWindow () {
  window.close()
}

function syncBrowserWindowState () {
  if (windowType.value !== 'browser') return
  activeSkillPackage.value = getStoredSkillPackage()
}

onMounted(() => {
  try {
    windowType.value = window.utools.getWindowType()
  } catch (error) {
    windowType.value = 'main'
  }

  window.utools.onPluginEnter((action) => {
    enterAction.value = action
  })

  syncBrowserWindowState()
})
</script>

<template>
  <SkillPackage
    v-if="shouldRenderSkillPackage"
    :skill-info="activeSkillPackage"
    @back="closeSkillPackageWindow"
  />
  <SkillManager v-else :enter-action="enterAction" />
</template>
