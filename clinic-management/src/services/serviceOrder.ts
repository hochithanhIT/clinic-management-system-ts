import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface ServiceOrderSummary {
  id: number
  code: string
  createdAt: string
  status: number
  medicalRecordId: number
  medicalRecordCode: string
}

interface GetServiceOrdersResponse {
  serviceOrders: Array<{
    id: number
    maPhieuCD: string
    thoiGianTao: string
    trangThai: number
    benhAn: {
      id: number
      maBA: string
    }
  }>
  pagination: PaginationMeta
}

export interface GetServiceOrdersParams {
  page?: number
  limit?: number
  search?: string
  medicalRecordId?: number
}

export const getServiceOrders = async (
  params: GetServiceOrdersParams = {},
): Promise<{ serviceOrders: ServiceOrderSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search, medicalRecordId } = params

  const response = await apiFetch<ApiSuccessResponse<GetServiceOrdersResponse>>("/service-order", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      medicalRecordId,
    },
  })

  const { serviceOrders, pagination } = response.data

  return {
    serviceOrders: serviceOrders.map((order) => ({
      id: order.id,
      code: order.maPhieuCD,
      createdAt: order.thoiGianTao,
      status: order.trangThai,
      medicalRecordId: order.benhAn.id,
      medicalRecordCode: order.benhAn.maBA,
    })),
    pagination,
  }
}

export interface ServiceOrderDetailSummary {
  id: number
  quantity: number
  amount: number
  requireResult: boolean
  isPaid: boolean
  service: {
    id: number
    code: string
    name: string
  }
  serviceOrderId: number
  serviceOrderCode: string
}

interface GetServiceOrderDetailsResponse {
  serviceOrderDetails: Array<{
    id: number
    soLuong: number
    tongTien: number
    yeuCauKQ: boolean
    trangThaiDongTien: boolean
    dichVu: {
      id: number
      maDV: string
      tenDV: string
    }
    phieuChiDinh: {
      id: number
      maPhieuCD: string
    }
  }>
}

export const getServiceOrderDetails = async (
  serviceOrderId: number,
): Promise<{ serviceOrderDetails: ServiceOrderDetailSummary[] }> => {
  const response = await apiFetch<ApiSuccessResponse<GetServiceOrderDetailsResponse>>(
    `/service-order/${serviceOrderId}/detail`,
    {
      method: "GET",
    },
  )

  const { serviceOrderDetails } = response.data

  return {
    serviceOrderDetails: serviceOrderDetails.map((detail) => ({
      id: detail.id,
      quantity: detail.soLuong,
      amount: detail.tongTien,
      requireResult: detail.yeuCauKQ,
      isPaid: detail.trangThaiDongTien,
      service: {
        id: detail.dichVu.id,
        code: detail.dichVu.maDV,
        name: detail.dichVu.tenDV,
      },
      serviceOrderId: detail.phieuChiDinh.id,
      serviceOrderCode: detail.phieuChiDinh.maPhieuCD,
    })),
  }
}
