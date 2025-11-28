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

type RawInvoice = {
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
}

interface GetInvoicesResponse {
  invoices: RawInvoice[]
  pagination: PaginationMeta
}

export interface GetInvoicesParams {
  page?: number
  limit?: number
  medicalRecordId?: number
  search?: string
}

export interface SettleInvoicePayload {
  medicalRecordId: number
  employeeId: number
  invoiceDate: string
  amountReceived: number
  serviceDetailIds: number[]
}

export interface InvoicePaymentSummary {
  total: number
  received: number
  change: number
}

export interface InvoiceDetailItem {
  id: number
  serviceName: string
  serviceCode: string
  quantity: number
  unitPrice: number
  totalAmount: number
  serviceOrderCode: string | null
}

interface RawInvoiceDetail {
  id: number
  soLuong: number
  thanhTien: number | string
  chiTietPCD: {
    id: number
    soLuong: number
    tongTien: number | string
    dichVu: {
      id: number
      maDV: string
      tenDV: string
    }
    phieuChiDinh: {
      id: number
      maPhieuCD: string
    } | null
  }
}

interface SettleInvoiceResponse {
  invoice: RawInvoice
  payment: {
    total: number | string
    received: number | string
    change: number | string
  }
}

interface GetInvoiceResponse {
  invoice: RawInvoice
  details: RawInvoiceDetail[]
}

const toAmount = (value: number | string): number => {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const mapToInvoiceSummary = (invoice: RawInvoice): InvoiceSummary => ({
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
})

const mapToInvoiceDetailItem = (detail: RawInvoiceDetail): InvoiceDetailItem => {
  const quantity = Number.isFinite(detail.soLuong) ? detail.soLuong : 0
  const totalAmount = toAmount(detail.thanhTien)
  const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount

  return {
    id: detail.id,
    serviceName: detail.chiTietPCD.dichVu.tenDV,
    serviceCode: detail.chiTietPCD.dichVu.maDV,
    quantity,
    unitPrice,
    totalAmount,
    serviceOrderCode: detail.chiTietPCD.phieuChiDinh?.maPhieuCD ?? null,
  }
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
    invoices: invoices.map(mapToInvoiceSummary),
    pagination,
  }
}

export const settleInvoice = async (
  payload: SettleInvoicePayload,
): Promise<{ invoice: InvoiceSummary; payment: InvoicePaymentSummary }> => {
  const response = await apiFetch<ApiSuccessResponse<SettleInvoiceResponse>>("/invoice/pay", {
    method: "POST",
    json: payload,
  })

  const { invoice, payment } = response.data

  return {
    invoice: mapToInvoiceSummary(invoice),
    payment: {
      total: toAmount(payment.total),
      received: toAmount(payment.received),
      change: toAmount(payment.change),
    },
  }
}

export const getInvoiceDetails = async (
  invoiceId: number,
): Promise<{ invoice: InvoiceSummary; details: InvoiceDetailItem[] }> => {
  const response = await apiFetch<ApiSuccessResponse<GetInvoiceResponse>>(
    `/invoice/${invoiceId}`,
    {
      method: "GET",
    },
  )

  const { invoice, details } = response.data

  return {
    invoice: mapToInvoiceSummary(invoice),
    details: details.map(mapToInvoiceDetailItem),
  }
}
