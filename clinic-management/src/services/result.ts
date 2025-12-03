import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface ResultSummary {
  id: number
  receivedAt: string
  performedAt: string
  deliveredAt: string
  result: string
  conclusion: string
  note: string | null
  url: string | null
  serviceOrderDetail: {
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
    serviceOrder: {
      id: number
      code: string
    }
  }
}

interface GetResultsResponse {
  results: Array<{
    id: number
    tgTiepNhan: string
    tgThucHien: string
    tgTraKQ: string
    ketQua: string
    ketLuan: string
    ghiChu: string | null
    url: string | null
    chiTietPhieuChiDinh: {
      id: number
      soLuong: number
      tongTien: number
      yeuCauKQ: boolean
      trangThaiDongTien: boolean
      phieuChiDinh: {
        id: number
        maPhieuCD: string
      }
      dichVu: {
        id: number
        maDV: string
        tenDV: string
      }
    }
  }>
  pagination: PaginationMeta
}

export interface GetResultsParams {
  page?: number
  limit?: number
  search?: string
  serviceOrderId?: number
  ctpcdId?: number
  medicalRecordId?: number
  serviceId?: number
}

export const getResults = async (
  params: GetResultsParams = {},
): Promise<{ results: ResultSummary[]; pagination: PaginationMeta }> => {
  const {
    page = 1,
    limit = 100,
    search,
    serviceOrderId,
    ctpcdId,
    medicalRecordId,
    serviceId,
  } = params

  const response = await apiFetch<ApiSuccessResponse<GetResultsResponse>>("/result", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      serviceOrderId,
      ctpcdId,
      medicalRecordId,
      serviceId,
    },
  })

  const { results, pagination } = response.data

  return {
    results: results.map((result) => ({
      id: result.id,
      receivedAt: result.tgTiepNhan,
      performedAt: result.tgThucHien,
      deliveredAt: result.tgTraKQ,
      result: result.ketQua,
      conclusion: result.ketLuan,
      note: result.ghiChu,
      url: result.url,
      serviceOrderDetail: {
        id: result.chiTietPhieuChiDinh.id,
        quantity: result.chiTietPhieuChiDinh.soLuong,
        amount: Number(result.chiTietPhieuChiDinh.tongTien),
        requireResult: result.chiTietPhieuChiDinh.yeuCauKQ,
        isPaid: result.chiTietPhieuChiDinh.trangThaiDongTien,
        service: {
          id: result.chiTietPhieuChiDinh.dichVu.id,
          code: result.chiTietPhieuChiDinh.dichVu.maDV,
          name: result.chiTietPhieuChiDinh.dichVu.tenDV,
        },
        serviceOrder: {
          id: result.chiTietPhieuChiDinh.phieuChiDinh.id,
          code: result.chiTietPhieuChiDinh.phieuChiDinh.maPhieuCD,
        },
      },
    })),
    pagination,
  }
}
