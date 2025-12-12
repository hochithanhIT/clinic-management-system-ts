import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

interface PositionResponse {
  id: number
  tenChucVu: string
}

interface PositionListResponse {
  positions: PositionResponse[]
  pagination: PaginationMeta
}

export interface PositionSummary {
  id: number
  name: string
}

export interface GetPositionsParams {
  page?: number
  limit?: number
  search?: string
}

export const getPositions = async (
  params: GetPositionsParams = {},
): Promise<{ positions: PositionSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search } = params

  const response = await apiFetch<ApiSuccessResponse<PositionListResponse>>("/position", {
    method: "GET",
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
    },
  })

  const { positions, pagination } = response.data

  return {
    positions: positions.map((position) => ({ id: position.id, name: position.tenChucVu })),
    pagination,
  }
}

