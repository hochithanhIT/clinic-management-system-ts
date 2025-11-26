import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"

export interface DepartmentSummary {
  id: number
  name: string
  roomCount: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface DepartmentListResponse {
  departments: Array<{
    id: number
    tenKhoa: string
    soPhong: number
  }>
  pagination: PaginationMeta
}

export interface GetDepartmentsParams {
  page?: number
  limit?: number
  search?: string
}

export const getDepartments = async (
  params: GetDepartmentsParams = {},
): Promise<{ departments: DepartmentSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search } = params

  const response = await apiFetch<ApiSuccessResponse<DepartmentListResponse>>("/department", {
    method: "GET",
    params: {
      page,
      limit,
      search,
    },
  })

  const { departments, pagination } = response.data

  return {
    departments: departments.map((department) => ({
      id: department.id,
      name: department.tenKhoa,
      roomCount: department.soPhong,
    })),
    pagination,
  }
}
