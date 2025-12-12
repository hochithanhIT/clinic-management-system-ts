import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

interface TitleResponse {
  id: number
  tenChucDanh: string
}

interface TitleListResponse {
  titles: TitleResponse[]
  pagination: PaginationMeta
}

export interface TitleSummary {
  id: number
  name: string
}

export interface GetTitlesParams {
  page?: number
  limit?: number
  search?: string
}

export const getTitles = async (
  params: GetTitlesParams = {},
): Promise<{ titles: TitleSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search } = params

  const response = await apiFetch<ApiSuccessResponse<TitleListResponse>>("/title", {
    method: "GET",
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
    },
  })

  const { titles, pagination } = response.data

  return {
    titles: titles.map((title) => ({ id: title.id, name: title.tenChucDanh })),
    pagination,
  }
}

