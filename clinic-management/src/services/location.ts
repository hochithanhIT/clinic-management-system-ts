import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface CitySummary {
  id: number
  code: string
  name: string
}

export interface WardSummary {
  id: number
  code: string
  name: string
  city: CitySummary | null
}

interface CityListResponse {
  cities: Array<{
    id: number
    maTinhTP: string
    tenTinhTP: string
  }>
  pagination: PaginationMeta
}

interface ProvinceListResponse {
  provinces: Array<{
    id: number
    maXaPhuong: string
    tenXaPhuong: string
    city: {
      id: number
      maTinhTP: string
      tenTinhTP: string
    } | null
  }>
  pagination: PaginationMeta
}

export interface GetCitiesParams {
  page?: number
  limit?: number
  search?: string
}

export interface GetProvincesParams {
  page?: number
  limit?: number
  search?: string
  cityId?: number
}

export const getCities = async (
  params: GetCitiesParams = {},
): Promise<{ cities: CitySummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search } = params

  const response = await apiFetch<ApiSuccessResponse<CityListResponse>>("/location/cities", {
    method: "GET",
    params: {
      page,
      limit,
      search,
    },
  })

  const { cities, pagination } = response.data

  return {
    cities: cities.map((city) => ({
      id: city.id,
      code: city.maTinhTP,
      name: city.tenTinhTP,
    })),
    pagination,
  }
}

export const getProvinces = async (
  params: GetProvincesParams = {},
): Promise<{ provinces: WardSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search, cityId } = params

  const response = await apiFetch<ApiSuccessResponse<ProvinceListResponse>>("/location/provinces", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      cityId,
    },
  })

  const { provinces, pagination } = response.data

  return {
    provinces: provinces.map((province) => ({
      id: province.id,
      code: province.maXaPhuong,
      name: province.tenXaPhuong,
      city: province.city
        ? {
            id: province.city.id,
            code: province.city.maTinhTP,
            name: province.city.tenTinhTP,
          }
        : null,
    })),
    pagination,
  }
}
