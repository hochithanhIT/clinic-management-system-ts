import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface OccupationSummary {
  id: number
  code: string
  name: string
}

interface OccupationListResponse {
  occupations: Array<{
    id: number
    maNgheNghiep: string
    tenNgheNghiep: string
  }>
  pagination: PaginationMeta
}

export interface GetOccupationsParams {
  page?: number
  limit?: number
  search?: string
}

export const getOccupations = async (
  params: GetOccupationsParams = {},
): Promise<{ occupations: OccupationSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search } = params

  const response = await apiFetch<ApiSuccessResponse<OccupationListResponse>>("/occupation", {
    method: "GET",
    params: {
      page,
      limit,
      search,
    },
  })

  const { occupations, pagination } = response.data

  return {
    occupations: occupations.map((occupation) => ({
      id: occupation.id,
      code: occupation.maNgheNghiep,
      name: occupation.tenNgheNghiep,
    })),
    pagination,
  }
}

export const getAllOccupations = async (
  params: Omit<GetOccupationsParams, "page"> = {},
): Promise<OccupationSummary[]> => {
  const limit = params.limit ?? 100
  const search = params.search

  const allOccupations: OccupationSummary[] = []
  let currentPage = 1
  let totalPages = 1

  do {
    const { occupations, pagination } = await getOccupations({
      page: currentPage,
      limit,
      search,
    })

    allOccupations.push(...occupations)
    totalPages = pagination.totalPages ?? 0
    currentPage += 1
  } while (currentPage <= totalPages && totalPages !== 0)

  return allOccupations
}
