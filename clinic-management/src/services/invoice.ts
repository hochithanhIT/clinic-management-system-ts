import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface InvoiceSummary {
  id: number
  code: string
  amount: number
  paidAt: string
  status: number
  medicalRecordId: number
  medicalRecordCode: string
  collector: {
    id: number
    code: string
    name: string
  } | null
}

interface GetInvoicesResponse {
  invoices: Array<{
    id: number
    maHD: string
    ngayLap: string
    tongTien: number | string
    trangThai: number
    benhAn: {
      id: number
      maBA: string
    }
    nhanVien: {
      id: number
      maNV: string
      hoTen: string
    } | null
  }>
  pagination: PaginationMeta
}

export interface GetInvoicesParams {
  page?: number
  limit?: number
  medicalRecordId?: number
  search?: string
}

const toAmount = (value: number | string): number => {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const INVOICE_STATUS = {
  active: 0,
  cancelled: 1,
} as const

export const getInvoices = async (
  params: GetInvoicesParams = {},
): Promise<{ invoices: InvoiceSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 10, medicalRecordId, search } = params

  const response = await apiFetch<ApiSuccessResponse<GetInvoicesResponse>>("/invoice", {
    method: "GET",
    params: {
      page,
      limit,
      medicalRecordId,
      search,
    },
  })

  const { invoices, pagination } = response.data

  return {
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      code: invoice.maHD,
      amount: toAmount(invoice.tongTien),
      paidAt: invoice.ngayLap,
      status: invoice.trangThai,
      medicalRecordId: invoice.benhAn.id,
      medicalRecordCode: invoice.benhAn.maBA,
      collector: invoice.nhanVien
        ? {
            id: invoice.nhanVien.id,
            code: invoice.nhanVien.maNV,
            name: invoice.nhanVien.hoTen,
          }
        : null,
    })),
    pagination,
  }
}
