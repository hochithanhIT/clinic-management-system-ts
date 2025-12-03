import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"
import type { MedicalStaffSummary } from "./medicalRecord"

export interface ServiceOrderSummary {
  id: number
  code: string
  createdAt: string
  status: number
  medicalRecordId: number
  medicalRecordCode: string
  orderingStaff: MedicalStaffSummary | null
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
    nvChiDinh: {
      id: number
      hoTen: string
      maNV: string
      khoa: {
        id: number
        tenKhoa: string
      } | null
    } | null
  }>
  pagination: PaginationMeta
}

export interface GetServiceOrdersParams {
  page?: number
  limit?: number
  search?: string
  medicalRecordId?: number
}

type ServiceOrderStaffResponse = {
  id: number
  hoTen: string
  maNV: string
  khoa: {
    id: number
    tenKhoa: string
  } | null
} | null

const mapStaff = (staff: ServiceOrderStaffResponse): MedicalStaffSummary | null => {
  if (!staff) {
    return null
  }

  return {
    id: staff.id,
    name: staff.hoTen,
    code: staff.maNV,
    department: staff.khoa
      ? {
          id: staff.khoa.id,
          name: staff.khoa.tenKhoa,
        }
      : null,
  }
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
      orderingStaff: mapStaff(order.nvChiDinh),
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
  hasResult: boolean
  service: {
    id: number
    code: string
    name: string
    group: {
      id: number
      name: string
      type: {
        id: number
        name: string
      } | null
    } | null
    type: {
      id: number
      name: string
    } | null
    executionRoom: {
      id: number
      name: string
      departmentId: number | null
      departmentName: string | null
    } | null
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
      nhomDichVu: {
        id: number
        tenNhomDV: string
        loaiDichVu: {
          id: number
          tenLoai: string
        } | null
      } | null
      phongThucHien: {
        id: number
        tenPhong: string
        khoa: {
          id: number
          tenKhoa: string
        } | null
      } | null
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
      amount: Number(detail.tongTien),
      requireResult: detail.yeuCauKQ,
      isPaid: detail.trangThaiDongTien,
      hasResult: Boolean(detail.ketQua),
      service: {
        id: detail.dichVu.id,
        code: detail.dichVu.maDV,
        name: detail.dichVu.tenDV,
        group: detail.dichVu.nhomDichVu
          ? {
              id: detail.dichVu.nhomDichVu.id,
              name: detail.dichVu.nhomDichVu.tenNhomDV,
              type: detail.dichVu.nhomDichVu.loaiDichVu
                ? {
                    id: detail.dichVu.nhomDichVu.loaiDichVu.id,
                    name: detail.dichVu.nhomDichVu.loaiDichVu.tenLoai,
                  }
                : null,
            }
          : null,
        type: detail.dichVu.nhomDichVu?.loaiDichVu
          ? {
              id: detail.dichVu.nhomDichVu.loaiDichVu.id,
              name: detail.dichVu.nhomDichVu.loaiDichVu.tenLoai,
            }
          : null,
        executionRoom: detail.dichVu.phongThucHien
          ? {
              id: detail.dichVu.phongThucHien.id,
              name: detail.dichVu.phongThucHien.tenPhong,
              departmentId: detail.dichVu.phongThucHien.khoa?.id ?? null,
              departmentName: detail.dichVu.phongThucHien.khoa?.tenKhoa ?? null,
            }
          : null,
      },
      serviceOrderId: detail.phieuChiDinh.id,
      serviceOrderCode: detail.phieuChiDinh.maPhieuCD,
    })),
  }
}

const serializeDateInput = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

interface CreateServiceOrderResponse {
  serviceOrder: {
    id: number
    maPhieuCD: string
    thoiGianTao: string
    trangThai: number
    benhAn: {
      id: number
      maBA: string
    }
    nvChiDinh: {
      id: number
      hoTen: string
      maNV: string
      khoa: {
        id: number
        tenKhoa: string
      } | null
    } | null
  }
}

export interface CreateServiceOrderPayload {
  code: string
  medicalRecordId: number
  createdAt: string | Date
  status: number
  assignedStaffId?: number
}

export interface UpdateServiceOrderPayload {
  code?: string
  medicalRecordId?: number
  createdAt?: string | Date
  status?: number
  assignedStaffId?: number | null
}

export const createServiceOrder = async (
  payload: CreateServiceOrderPayload,
): Promise<ServiceOrderSummary> => {
  const requestBody: Record<string, unknown> = {
    maPhieuCD: payload.code,
    benhAnId: payload.medicalRecordId,
    thoiGianTao: serializeDateInput(payload.createdAt),
    trangThai: payload.status,
  }

  if (typeof payload.assignedStaffId === "number") {
    requestBody.nvChiDinhId = payload.assignedStaffId
  }

  const response = await apiFetch<ApiSuccessResponse<CreateServiceOrderResponse>>("/service-order", {
    method: "POST",
    json: requestBody,
  })

  const { serviceOrder } = response.data

  return {
    id: serviceOrder.id,
    code: serviceOrder.maPhieuCD,
    createdAt: serviceOrder.thoiGianTao,
    status: serviceOrder.trangThai,
    medicalRecordId: serviceOrder.benhAn.id,
    medicalRecordCode: serviceOrder.benhAn.maBA,
    orderingStaff: mapStaff(serviceOrder.nvChiDinh),
  }
}

export const updateServiceOrder = async (
  serviceOrderId: number,
  payload: UpdateServiceOrderPayload,
): Promise<ServiceOrderSummary> => {
  const requestBody: Record<string, unknown> = {}

  if (payload.code !== undefined) {
    requestBody.maPhieuCD = payload.code
  }

  if (payload.medicalRecordId !== undefined) {
    requestBody.benhAnId = payload.medicalRecordId
  }

  if (payload.createdAt !== undefined) {
    requestBody.thoiGianTao = serializeDateInput(payload.createdAt)
  }

  if (payload.status !== undefined) {
    requestBody.trangThai = payload.status
  }

  if (Object.prototype.hasOwnProperty.call(payload, "assignedStaffId")) {
    requestBody.nvChiDinhId = payload.assignedStaffId ?? null
  }

  if (Object.keys(requestBody).length === 0) {
    throw new Error("updateServiceOrder requires at least one field to update")
  }

  const response = await apiFetch<ApiSuccessResponse<CreateServiceOrderResponse>>(
    `/service-order/${serviceOrderId}`,
    {
      method: "PUT",
      json: requestBody,
    },
  )

  const { serviceOrder } = response.data

  return {
    id: serviceOrder.id,
    code: serviceOrder.maPhieuCD,
    createdAt: serviceOrder.thoiGianTao,
    status: serviceOrder.trangThai,
    medicalRecordId: serviceOrder.benhAn.id,
    medicalRecordCode: serviceOrder.benhAn.maBA,
    orderingStaff: mapStaff(serviceOrder.nvChiDinh),
  }
}

interface CreateServiceOrderDetailResponse {
  serviceOrderDetail: {
    id: number
    soLuong: number
    tongTien: number
    yeuCauKQ: boolean
    trangThaiDongTien: boolean
    ketQua: {
      id: number
    } | null
    dichVu: {
      id: number
      maDV: string
      tenDV: string
      nhomDichVu: {
        id: number
        tenNhomDV: string
        loaiDichVu: {
          id: number
          tenLoai: string
        } | null
      } | null
      phongThucHien: {
        id: number
        tenPhong: string
        khoa: {
          id: number
          tenKhoa: string
        } | null
      } | null
    }
    phieuChiDinh: {
      id: number
      maPhieuCD: string
    }
  }
}

export interface CreateServiceOrderDetailPayload {
  serviceOrderId: number
  serviceId: number
  quantity: number
  amount: number
  requireResult: boolean
  isPaid: boolean
}

export interface UpdateServiceOrderDetailPayload {
  serviceOrderId?: number
  serviceId?: number
  quantity?: number
  amount?: number
  requireResult?: boolean
  isPaid?: boolean
}

export const createServiceOrderDetail = async (
  payload: CreateServiceOrderDetailPayload,
): Promise<ServiceOrderDetailSummary> => {
  const response = await apiFetch<ApiSuccessResponse<CreateServiceOrderDetailResponse>>("/service-order/detail", {
    method: "POST",
    json: {
      phieuChiDinhId: payload.serviceOrderId,
      dichVuId: payload.serviceId,
      soLuong: payload.quantity,
      tongTien: payload.amount,
      yeuCauKQ: payload.requireResult,
      trangThaiDongTien: payload.isPaid,
    },
  })

  const { serviceOrderDetail } = response.data

  return {
    id: serviceOrderDetail.id,
    quantity: serviceOrderDetail.soLuong,
    amount: Number(serviceOrderDetail.tongTien),
    requireResult: serviceOrderDetail.yeuCauKQ,
    isPaid: serviceOrderDetail.trangThaiDongTien,
    hasResult: Boolean(serviceOrderDetail.ketQua),
    service: {
      id: serviceOrderDetail.dichVu.id,
      code: serviceOrderDetail.dichVu.maDV,
      name: serviceOrderDetail.dichVu.tenDV,
      group: serviceOrderDetail.dichVu.nhomDichVu
        ? {
            id: serviceOrderDetail.dichVu.nhomDichVu.id,
            name: serviceOrderDetail.dichVu.nhomDichVu.tenNhomDV,
            type: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu
              ? {
                  id: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.id,
                  name: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.tenLoai,
                }
              : null,
          }
        : null,
      type: serviceOrderDetail.dichVu.nhomDichVu?.loaiDichVu
        ? {
            id: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.id,
            name: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.tenLoai,
          }
        : null,
      executionRoom: serviceOrderDetail.dichVu.phongThucHien
        ? {
            id: serviceOrderDetail.dichVu.phongThucHien.id,
            name: serviceOrderDetail.dichVu.phongThucHien.tenPhong,
            departmentId: serviceOrderDetail.dichVu.phongThucHien.khoa?.id ?? null,
            departmentName: serviceOrderDetail.dichVu.phongThucHien.khoa?.tenKhoa ?? null,
          }
        : null,
    },
    serviceOrderId: serviceOrderDetail.phieuChiDinh.id,
    serviceOrderCode: serviceOrderDetail.phieuChiDinh.maPhieuCD,
  }
}

export const updateServiceOrderDetail = async (
  serviceOrderDetailId: number,
  payload: UpdateServiceOrderDetailPayload,
): Promise<ServiceOrderDetailSummary> => {
  const requestBody: Record<string, unknown> = {}

  if (payload.serviceOrderId !== undefined) {
    requestBody.phieuChiDinhId = payload.serviceOrderId
  }

  if (payload.serviceId !== undefined) {
    requestBody.dichVuId = payload.serviceId
  }

  if (payload.quantity !== undefined) {
    requestBody.soLuong = payload.quantity
  }

  if (payload.amount !== undefined) {
    requestBody.tongTien = payload.amount
  }

  if (payload.requireResult !== undefined) {
    requestBody.yeuCauKQ = payload.requireResult
  }

  if (payload.isPaid !== undefined) {
    requestBody.trangThaiDongTien = payload.isPaid
  }

  if (Object.keys(requestBody).length === 0) {
    throw new Error("updateServiceOrderDetail requires at least one field to update")
  }

  const response = await apiFetch<ApiSuccessResponse<CreateServiceOrderDetailResponse>>(
    `/service-order/detail/${serviceOrderDetailId}`,
    {
      method: "PUT",
      json: requestBody,
    },
  )

  const { serviceOrderDetail } = response.data

  return {
    id: serviceOrderDetail.id,
    quantity: serviceOrderDetail.soLuong,
    amount: Number(serviceOrderDetail.tongTien),
    requireResult: serviceOrderDetail.yeuCauKQ,
    isPaid: serviceOrderDetail.trangThaiDongTien,
    hasResult: Boolean(serviceOrderDetail.ketQua),
    service: {
      id: serviceOrderDetail.dichVu.id,
      code: serviceOrderDetail.dichVu.maDV,
      name: serviceOrderDetail.dichVu.tenDV,
      group: serviceOrderDetail.dichVu.nhomDichVu
        ? {
            id: serviceOrderDetail.dichVu.nhomDichVu.id,
            name: serviceOrderDetail.dichVu.nhomDichVu.tenNhomDV,
            type: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu
              ? {
                  id: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.id,
                  name: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.tenLoai,
                }
              : null,
          }
        : null,
      type: serviceOrderDetail.dichVu.nhomDichVu?.loaiDichVu
        ? {
            id: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.id,
            name: serviceOrderDetail.dichVu.nhomDichVu.loaiDichVu.tenLoai,
          }
        : null,
      executionRoom: serviceOrderDetail.dichVu.phongThucHien
        ? {
            id: serviceOrderDetail.dichVu.phongThucHien.id,
            name: serviceOrderDetail.dichVu.phongThucHien.tenPhong,
            departmentId: serviceOrderDetail.dichVu.phongThucHien.khoa?.id ?? null,
            departmentName: serviceOrderDetail.dichVu.phongThucHien.khoa?.tenKhoa ?? null,
          }
        : null,
    },
    serviceOrderId: serviceOrderDetail.phieuChiDinh.id,
    serviceOrderCode: serviceOrderDetail.phieuChiDinh.maPhieuCD,
  }
}

export const deleteServiceOrderDetail = async (serviceOrderDetailId: number): Promise<void> => {
  await apiFetch(`/service-order/detail/${serviceOrderDetailId}`, {
    method: "DELETE",
  })
}
