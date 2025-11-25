import axios, { AxiosError } from "axios"
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios"

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

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Keep the interface available for future auth token injection if needed.
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response) {
      const status = error.response.status ?? 500
      const responseData = error.response.data
      const message =
        (responseData?.message && typeof responseData.message === "string" && responseData.message.trim()) ||
        error.message ||
        "Request failed"

      return Promise.reject(new ApiError(status, message, responseData))
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
