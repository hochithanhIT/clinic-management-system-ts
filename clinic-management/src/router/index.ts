import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, from) => {
  const loggedIn = false
  if (to.meta.requiresAuth && !loggedIn) {
    router.replace({ name: '/login/' })
  }
})

export default router
