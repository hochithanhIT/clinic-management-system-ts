import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

interface RoleResponse {
  id: number
  tenVaiTro: string
}

interface RoleListResponse {
  roles: RoleResponse[]
  pagination: PaginationMeta
}

export interface RoleSummary {
  id: number
  name: string
}

export interface GetRolesParams {
  page?: number
  limit?: number
  search?: string
}

export const getRoles = async (
  params: GetRolesParams = {},
): Promise<{ roles: RoleSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search } = params

  const response = await apiFetch<ApiSuccessResponse<RoleListResponse>>("/role", {
    method: "GET",
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
    },
  })

  const { roles, pagination } = response.data

  return {
    roles: roles.map((role) => ({ id: role.id, name: role.tenVaiTro })),
    pagination,
  }
}

