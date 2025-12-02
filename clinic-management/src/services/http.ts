import axios, { AxiosError } from "axios"
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios"

import { emitUnauthorizedEvent } from "@/lib/auth-events"

const DEFAULT_API_BASE_URL = "http://localhost:3000/api"

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "")

export interface ApiSuccessResponse<T> {
  ok: true
  message: string
  data: T
  [key: string]: unknown
}

export interface ApiErrorResponse {
  ok: false
  message: string
  data?: unknown
  errors?: Record<string, string[]>
  [key: string]: unknown
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export interface ApiRequestConfig<T = unknown> extends AxiosRequestConfig<T> {
  json?: T
}

const REFRESH_ENDPOINT = "/auth/refresh-token"

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshPromise: Promise<void> | null = null

const refreshAccessToken = async (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<ApiSuccessResponse<null>>(REFRESH_ENDPOINT)
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

const rejectWithApiError = <T>(status: number, message: string, details?: T) => {
  if (status === 401) {
    emitUnauthorizedEvent()
  }

  return Promise.reject(new ApiError(status, message, details))
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Keep the interface available for future auth token injection if needed.
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined

    if (error.response) {
      const status = error.response.status ?? 500
      const responseData = error.response.data
      const message =
        (responseData?.message && typeof responseData.message === "string" && responseData.message.trim()) ||
        error.message ||
        "Request failed"

      const shouldAttemptRefresh =
        status === 401 &&
        originalRequest !== undefined &&
        !originalRequest._retry &&
        !originalRequest.url?.includes(REFRESH_ENDPOINT)

      if (shouldAttemptRefresh) {
        originalRequest._retry = true

        try {
          await refreshAccessToken()
          return apiClient.request(originalRequest)
        } catch (refreshError) {
          if (refreshError instanceof ApiError) {
            if (refreshError.status === 401) {
              emitUnauthorizedEvent()
            }
            return Promise.reject(refreshError)
          }

          if (refreshError instanceof AxiosError && refreshError.response) {
            const refreshStatus = refreshError.response.status ?? 500
            const refreshData = refreshError.response.data
            const refreshMessage =
              (refreshData?.message && typeof refreshData.message === "string" && refreshData.message.trim()) ||
              refreshError.message ||
              "Request failed"

            return rejectWithApiError(refreshStatus, refreshMessage, refreshData)
          }

          if (refreshError instanceof Error) {
            return rejectWithApiError(status, refreshError.message)
          }

          return rejectWithApiError(status, message, responseData)
        }
      }

      return rejectWithApiError(status, message, responseData)
    }

    if (error.code === "ECONNABORTED") {
      return Promise.reject(new ApiError(0, "Request timed out", error.toJSON()))
    }

    return Promise.reject(new ApiError(0, "Unable to reach the server", error.toJSON()))
  }
)

export const apiFetch = async <TResponse = unknown, TData = unknown>(
  endpoint: string,
  config: ApiRequestConfig<TData> = {}
): Promise<TResponse> => {
  const { json, headers, ...rest } = config

  const requestConfig: AxiosRequestConfig<TData> = {
    url: endpoint,
    ...rest,
  }

  if (json !== undefined) {
    requestConfig.data = json
  }

  if (headers !== undefined) {
    requestConfig.headers = headers
  }

  const response = await apiClient.request<TResponse>(requestConfig)
  return response.data
}

export { apiClient }
