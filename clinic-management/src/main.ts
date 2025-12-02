import { createApp } from "vue"
import { createPinia } from "pinia"

import App from "./App.vue"
import router from "./router"
import "./style.css"
import "vue-sonner/style.css"
import { subscribeToUnauthorizedEvent } from "@/lib/auth-events"
import { useAuthStore } from "@/stores/auth"

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

const authStore = useAuthStore(pinia)

const redirectToLogin = () => {
	const currentRoute = router.currentRoute.value

	if (import.meta.env.DEV) {
		console.warn("[auth] redirecting to /login/", {
			from: currentRoute.fullPath,
		})
	}

	if (currentRoute.path === "/login/") {
		return
	}

	const redirect = currentRoute.fullPath && currentRoute.fullPath !== "/login/" ? { redirect: currentRoute.fullPath } : undefined
	router
		.replace({ path: "/login/", query: redirect })
		.catch((error) => {
			if (import.meta.env.DEV) {
				console.error("[auth] redirect failed", error)
			}

			if (typeof window !== "undefined") {
				window.location.href = "/login/"
			}
		})
}

const unsubscribeUnauthorized = subscribeToUnauthorizedEvent(() => {
	authStore.setUser(null)
	redirectToLogin()
})

const unsubscribeAuthStore = authStore.$subscribe((_mutation, state) => {
	if (state.user !== null) {
		return
	}

	redirectToLogin()
})

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		unsubscribeUnauthorized()
		unsubscribeAuthStore()
	})
}

app.mount("#app")
