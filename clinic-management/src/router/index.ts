import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  authStore.restoreSession()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    const redirect = to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : undefined
    return {
      name: '/login/',
      query: redirect,
    }
  }

  if (to.name === '/login/' && authStore.isAuthenticated) {
    return { name: '/' }
  }

  return true
})

export default router
