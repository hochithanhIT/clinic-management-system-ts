import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface DiseaseSummary {
  id: number
  code: string
  name: string
}

interface GetDiseasesResponse {
  diseases: Array<{
    id: number
    maICD10: string
    tenBenh: string
  }>
  pagination: PaginationMeta
}

export interface GetDiseasesParams {
  page?: number
  limit?: number
  search?: string
}

const mapDisease = (disease: GetDiseasesResponse["diseases"][number]): DiseaseSummary => {
  return {
    id: disease.id,
    code: disease.maICD10,
    name: disease.tenBenh,
  }
}

export const getDiseases = async (
  params: GetDiseasesParams = {},
): Promise<{ diseases: DiseaseSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 20, search } = params

  const response = await apiFetch<ApiSuccessResponse<GetDiseasesResponse>>("/disease", {
    method: "GET",
    params: {
      page,
      limit,
      search: search && search.trim() ? search.trim() : undefined,
    },
  })

  return {
    diseases: response.data.diseases.map(mapDisease),
    pagination: response.data.pagination,
  }
}
