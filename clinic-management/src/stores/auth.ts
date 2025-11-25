import { computed, ref } from "vue"
import { defineStore } from "pinia"

import type { AuthUser, LoginPayload } from "@/services/auth"
import { login as loginRequest, logout as logoutRequest } from "@/services/auth"
import { ApiError } from "@/services/http"

const STORAGE_KEY = "clinic-auth-user"

const readStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch (error) {
    console.warn("Unable to read user info from localStorage", error)
    return null
  }
}

const writeStoredUser = (value: AuthUser | null): void => {
  if (typeof window === "undefined") {
    return
  }
  try {
    if (!value) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch (error) {
    console.warn("Unable to persist user info", error)
  }
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(readStoredUser())
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const hasRestoredSession = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  const setUser = (account: AuthUser | null) => {
    user.value = account
    writeStoredUser(account)
  }

  const login = async (credentials: LoginPayload): Promise<AuthUser> => {
    loading.value = true
    errorMessage.value = null

    try {
      const account = await loginRequest(credentials)
      setUser(account)
      return account
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Sign in failed, please try again."
      errorMessage.value = message
      throw error
    } finally {
      loading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    loading.value = true

    try {
      await logoutRequest()
    } catch (error) {
      console.warn("Sign out failed", error)
    } finally {
      loading.value = false
      setUser(null)
      errorMessage.value = null
    }
  }

  const restoreSession = (): void => {
    if (hasRestoredSession.value) return
    setUser(readStoredUser())
    hasRestoredSession.value = true
  }

  return {
    user,
    loading,
    errorMessage,
    isAuthenticated,
    login,
    logout,
    restoreSession,
    setUser,
  }
})
