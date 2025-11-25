import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"

export interface LoginPayload {
  tenDangNhap: string
  matKhau: string
}

export interface AuthUser {
  id: number
  tenDangNhap: string
}

export const login = async (payload: LoginPayload): Promise<AuthUser> => {
  const response = await apiFetch<ApiSuccessResponse<AuthUser>>("/auth/login", {
    method: "POST",
    json: payload,
  })

  return response.data
}

export const logout = async (): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>("/auth/logout", {
    method: "POST",
  })
}
