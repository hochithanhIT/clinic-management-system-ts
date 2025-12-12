import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"

type CreateAccountResponse = {
  id: number
  tenDangNhap: string
}

type ResetPasswordResponse = {
  message?: string
}

export interface CreateAccountPayload {
  nhanVienId: number
  tenDangNhap: string
}

export interface ResetPasswordPayload {
  nhanVienId: number
}

export interface UpdateAccountStatusPayload {
  nhanVienId: number
  isActive: boolean
}

type UpdateAccountStatusResponse = {
  nhanVienId: number
  isActive: boolean
}

export const createAccount = async (
  payload: CreateAccountPayload,
): Promise<CreateAccountResponse> => {
  const response = await apiFetch<ApiSuccessResponse<CreateAccountResponse>>("/auth/create-account", {
    method: "POST",
    json: payload,
  })

  return response.data
}

export const resetAccountPassword = async (
  payload: ResetPasswordPayload,
): Promise<ResetPasswordResponse> => {
  const response = await apiFetch<ApiSuccessResponse<ResetPasswordResponse>>("/auth/reset-password", {
    method: "POST",
    json: payload,
  })

  return response.data
}

export const updateAccountStatus = async (
  payload: UpdateAccountStatusPayload,
): Promise<UpdateAccountStatusResponse> => {
  const response = await apiFetch<ApiSuccessResponse<UpdateAccountStatusResponse>>(
    "/auth/update-account-status",
    {
      method: "POST",
      json: payload,
    },
  )

  return response.data
}
