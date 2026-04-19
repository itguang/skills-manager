<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import SkillManager from './SkillManager/index.vue'

let standaloneWindow: any = null

const enterAction = ref({})
const windowType = ref<'main' | 'detach' | 'browser'>('main')
const delegatedToStandalone = ref(false)

const shouldRenderEmbeddedApp = computed(() => {
  return windowType.value !== 'main' || !delegatedToStandalone.value
})

function canReuseStandaloneWindow () {
  if (!standaloneWindow) return false

  try {
    if (typeof standaloneWindow.isDestroyed === 'function') {
      return !standaloneWindow.isDestroyed()
    }
  } catch (error) {
    return false
  }

  return true
}

function focusStandaloneWindow (targetWindow: any) {
  if (!targetWindow) return

  if (typeof targetWindow.show === 'function') {
    targetWindow.show()
  }

  if (typeof targetWindow.focus === 'function') {
    targetWindow.focus()
  }
}

function openStandaloneWindow () {
  delegatedToStandalone.value = true

  if (canReuseStandaloneWindow()) {
    focusStandaloneWindow(standaloneWindow)
    window.utools.hideMainWindow(false)
    return
  }

  const nextWindow = window.utools.createBrowserWindow(
    'index.html',
    {
      show: false,
      title: 'Skill Manager',
      width: 900,
      height: 750,
      minWidth: 900,
      minHeight: 750,
      resizable: true,
      minimizable: true,
      maximizable: true,
      center: true,
      autoHideMenuBar: true,
      closeable: true,
      webPreferences: {
        preload: 'preload/services.js'
      }
    },
    () => {
      focusStandaloneWindow(nextWindow)
      window.utools.hideMainWindow(false)
    }
  )

  standaloneWindow = nextWindow
}

onMounted(() => {
  try {
    windowType.value = window.utools.getWindowType()
  } catch (error) {
    windowType.value = 'main'
  }

  window.utools.onPluginEnter((action) => {
    enterAction.value = action

    if (windowType.value === 'main') {
      openStandaloneWindow()
    }
  })
})
</script>

<template>
  <SkillManager v-if="shouldRenderEmbeddedApp" :enter-action="enterAction" />
</template>
