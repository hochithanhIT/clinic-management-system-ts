import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  await authStore.restoreSession()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    const redirect = to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : undefined
    return {
      path: '/login/',
      query: redirect,
    }
  }

  if (to.path === '/login/' && authStore.isAuthenticated && authStore.sessionVerified) {
    return { path: '/' }
  }

  return true
})

export default router
