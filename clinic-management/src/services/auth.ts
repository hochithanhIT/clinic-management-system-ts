import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"

export interface LoginPayload {
  tenDangNhap: string
  matKhau: string
}

export interface AuthUser {
  id: number
  tenDangNhap: string
  hoTen: string
  role: {
    id: number
    name: string
  } | null
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface LoginResponsePayload {
  id: number
  tenDangNhap: string
  hoTen: string
  role: {
    id: number
    name: string
  } | null
}

export const login = async (payload: LoginPayload): Promise<AuthUser> => {
  const response = await apiFetch<ApiSuccessResponse<LoginResponsePayload>>("/auth/login", {
    method: "POST",
    json: payload,
  })

  const data = response.data

  return {
    id: data.id,
    tenDangNhap: data.tenDangNhap,
    hoTen: data.hoTen,
    role: data.role,
  }
}

export const logout = async (): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>("/auth/logout", {
    method: "POST",
  })
}

export const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>("/auth/change-password", {
    method: "POST",
    json: payload,
  })
}
