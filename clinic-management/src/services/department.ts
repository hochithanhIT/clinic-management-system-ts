import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface DepartmentSummary {
  id: number
  name: string
  roomCount: number
  isActive: boolean
}

interface DepartmentResponse {
  department: {
    id: number
    tenKhoa: string
    soPhong: number
    isActive: boolean
  }
}

interface DepartmentListResponse {
  departments: Array<{
    id: number
    tenKhoa: string
    soPhong: number
    isActive: boolean
  }>
  pagination: PaginationMeta
}

export interface GetDepartmentsParams {
  page?: number
  limit?: number
  search?: string
  status?: "active" | "inactive"
}

export const getDepartments = async (
  params: GetDepartmentsParams = {},
): Promise<{ departments: DepartmentSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search, status } = params

  const response = await apiFetch<ApiSuccessResponse<DepartmentListResponse>>("/department", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      status,
    },
  })

  const { departments, pagination } = response.data

  return {
    departments: departments.map((department) => ({
      id: department.id,
      name: department.tenKhoa,
      roomCount: department.soPhong,
      isActive: department.isActive,
    })),
    pagination,
  }
}

export interface UpdateDepartmentPayload {
  name: string
}

export interface CreateDepartmentPayload {
  name: string
}

export const createDepartment = async (
  payload: CreateDepartmentPayload,
): Promise<DepartmentSummary> => {
  const response = await apiFetch<ApiSuccessResponse<DepartmentResponse>>("/department", {
    method: "POST",
    json: {
      tenKhoa: payload.name.trim(),
    },
  })

  const { department } = response.data

  return {
    id: department.id,
    name: department.tenKhoa,
    roomCount: department.soPhong,
    isActive: department.isActive,
  }
}

export const updateDepartment = async (
  id: number,
  payload: UpdateDepartmentPayload,
): Promise<DepartmentSummary> => {
  const response = await apiFetch<ApiSuccessResponse<DepartmentResponse>>(`/department/${id}`, {
    method: "PUT",
    json: {
      tenKhoa: payload.name.trim(),
    },
  })

  const { department } = response.data

  return {
    id: department.id,
    name: department.tenKhoa,
    roomCount: department.soPhong,
    isActive: department.isActive,
  }
}

export const deleteDepartment = async (id: number): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>(`/department/${id}`, {
    method: "DELETE",
  })
}

export const restoreDepartment = async (id: number): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>(`/department/${id}/restore`, {
    method: "PATCH",
  })
}
