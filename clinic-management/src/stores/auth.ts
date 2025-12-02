import { computed, ref } from "vue"
import { defineStore } from "pinia"

import type { AuthUser, ChangePasswordPayload, LoginPayload } from "@/services/auth"
import { changePassword as changePasswordRequest, login as loginRequest, logout as logoutRequest } from "@/services/auth"
import { ApiError, apiClient } from "@/services/http"

const STORAGE_KEY = "clinic-auth-user"

const normalizeUser = (value: Partial<AuthUser> | null): AuthUser | null => {
  if (!value) {
    return null
  }

  if (typeof value.id !== "number" || typeof value.tenDangNhap !== "string") {
    return null
  }

  return {
    id: value.id,
    tenDangNhap: value.tenDangNhap,
    hoTen: typeof value.hoTen === "string" ? value.hoTen : "",
  }
}

const readStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    return normalizeUser(parsed)
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
  const sessionVerified = ref(false)
  let sessionVerificationPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)

  const setUser = (account: AuthUser | null, verified = true) => {
    const normalized = normalizeUser(account)
    user.value = normalized
    writeStoredUser(normalized)
    sessionVerified.value = normalized !== null && verified
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

  const changePassword = async (credentials: ChangePasswordPayload): Promise<void> => {
    loading.value = true
    errorMessage.value = null

    try {
      await changePasswordRequest(credentials)
      setUser(null)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Password update failed, please try again."
      errorMessage.value = message
      throw error
    } finally {
      loading.value = false
    }
  }

  const verifyStoredSession = async (): Promise<void> => {
    if (!user.value) {
      sessionVerified.value = false
      return
    }

    if (sessionVerified.value && !sessionVerificationPromise) {
      return
    }

    if (sessionVerificationPromise) {
      return sessionVerificationPromise
    }

    sessionVerificationPromise = apiClient
      .post("/auth/refresh-token")
      .then(() => {
        sessionVerified.value = true
      })
      .catch((error) => {
        sessionVerified.value = false

        if (error instanceof ApiError && error.status === 401) {
          // Unauthorized errors emit an event that clears the session elsewhere.
          return
        }

        console.warn("Session verification failed", error)
      })
      .finally(() => {
        sessionVerificationPromise = null
      })

    return sessionVerificationPromise
  }

  const restoreSession = async (): Promise<void> => {
    if (!hasRestoredSession.value) {
      hasRestoredSession.value = true
      const stored = readStoredUser()
      setUser(stored, false)
    }

    if (user.value && !sessionVerified.value) {
      await verifyStoredSession()
    }
  }

  return {
    user,
    loading,
    errorMessage,
    isAuthenticated,
    sessionVerified,
    login,
    logout,
    changePassword,
    restoreSession,
    setUser,
    verifyStoredSession,
  }
})
