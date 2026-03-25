<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import SkillManager from './SkillManager/index.vue'

const enterAction = ref({})

onMounted(() => {
  window.utools.onPluginEnter((action) => {
    enterAction.value = action
  })
})
</script>

<template>
  <SkillManager :enter-action="enterAction" />
</template>
