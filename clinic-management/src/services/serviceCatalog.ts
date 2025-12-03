import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface ServiceTypeSummary {
  id: number
  name: string
}

export interface ServiceGroupSummary {
  id: number
  name: string
  serviceType: ServiceTypeSummary
}

export interface ServiceExecutionRoomSummary {
  id: number
  name: string
  department?: {
    id: number
    name: string
  } | null
}

export interface ServiceSummary {
  id: number
  code: string
  name: string
  unit: string | null
  price: number
  referenceMin: string | null
  referenceMax: string | null
  serviceGroup: ServiceGroupSummary
  executionRoom: ServiceExecutionRoomSummary | null
}

interface GetServiceTypesResponse {
  serviceTypes: Array<{
    id: number
    tenLoai: string
  }>
}

export const getServiceTypes = async (): Promise<ServiceTypeSummary[]> => {
  const response = await apiFetch<ApiSuccessResponse<GetServiceTypesResponse>>("/service-type", {
    method: "GET",
  })

  return response.data.serviceTypes.map((item) => ({
    id: item.id,
    name: item.tenLoai,
  }))
}

interface GetServiceGroupsResponse {
  serviceGroups: Array<{
    id: number
    tenNhomDV: string
    loaiDichVu: {
      id: number
      tenLoai: string
    }
  }>
  pagination: PaginationMeta
}

export interface GetServiceGroupsParams {
  page?: number
  limit?: number
  search?: string
  serviceTypeId?: number
}

export const getServiceGroups = async (
  params: GetServiceGroupsParams = {},
): Promise<{ serviceGroups: ServiceGroupSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search, serviceTypeId } = params

  const response = await apiFetch<ApiSuccessResponse<GetServiceGroupsResponse>>("/service-group", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      loaiDichVuId: serviceTypeId,
    },
  })

  const { serviceGroups, pagination } = response.data

  return {
    serviceGroups: serviceGroups.map((group) => ({
      id: group.id,
      name: group.tenNhomDV,
      serviceType: {
        id: group.loaiDichVu.id,
        name: group.loaiDichVu.tenLoai,
      },
    })),
    pagination,
  }
}

interface GetServicesResponse {
  services: Array<{
    id: number
    maDV: string
    tenDV: string
    donVi: string | null
    donGia: string | number
    thamChieuMin: string | null
    thamChieuMax: string | null
    phongThucHienId: number | null
    phongThucHien: {
      id: number
      tenPhong: string
      khoa: {
        id: number
        tenKhoa: string
      } | null
    } | null
    nhomDichVu: {
      id: number
      tenNhomDV: string
      loaiDichVu: {
        id: number
        tenLoai: string
      }
    }
  }>
  pagination: PaginationMeta
}

export interface GetServicesParams {
  page?: number
  limit?: number
  search?: string
  serviceGroupId?: number
  serviceTypeId?: number
}

const parsePrice = (value: string | number): number => {
  const numeric = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export const getServices = async (
  params: GetServicesParams = {},
): Promise<{ services: ServiceSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search, serviceGroupId, serviceTypeId } = params

  const response = await apiFetch<ApiSuccessResponse<GetServicesResponse>>("/service", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      nhomDichVuId: serviceGroupId,
      loaiDichVuId: serviceTypeId,
    },
  })

  const { services, pagination } = response.data

  return {
    services: services.map((service) => ({
      id: service.id,
      code: service.maDV,
      name: service.tenDV,
      unit: service.donVi ?? null,
      price: parsePrice(service.donGia),
      referenceMin: service.thamChieuMin ?? null,
      referenceMax: service.thamChieuMax ?? null,
      serviceGroup: {
        id: service.nhomDichVu.id,
        name: service.nhomDichVu.tenNhomDV,
        serviceType: {
          id: service.nhomDichVu.loaiDichVu.id,
          name: service.nhomDichVu.loaiDichVu.tenLoai,
        },
      },
      executionRoom: service.phongThucHien
        ? {
            id: service.phongThucHien.id,
            name: service.phongThucHien.tenPhong,
            department: service.phongThucHien.khoa
              ? {
                  id: service.phongThucHien.khoa.id,
                  name: service.phongThucHien.khoa.tenKhoa,
                }
              : null,
          }
        : null,
    })),
    pagination,
  }
}
