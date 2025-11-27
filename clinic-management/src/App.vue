<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
import AppNavbar from './components/AppNavbar.vue'
import AppFooter from './components/AppFooter.vue'

const route = useRoute()

const showNavbar = computed(() => {
  return !(route.meta.hideNavbar as boolean)
})
</script>

<template>
  <div class="min-h-svh flex flex-col">
    <AppNavbar v-if="showNavbar" class="sticky top-0 z-50 bg-primary shadow-md shrink-0" />

    <main class="flex flex-1 overflow-auto">
      <router-view class="flex-1" />
    </main>

    <AppFooter v-if="showNavbar" class="shrink-0 sticky bottom-0 z-50" />
  </div>
  <Toaster position="top-right" richColors />
</template>

<style scoped></style>
