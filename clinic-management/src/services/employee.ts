import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

interface EmployeeResponse {
  id: number
  maNV: string
  hoTen: string
  ngaySinh: string | null
  gioiTinh: number | null
  sdt: string | null
  soChungChiHanhNghe: string | null
  ngayCapChungChi: string | null
  ngayHetHanChungChi: string | null
  daXoa: boolean
  khoa: { id: number; tenKhoa: string } | null
  chucDanh: { id: number; tenChucDanh: string } | null
  chucVu: { id: number; tenChucVu: string } | null
  vaiTro: { id: number; tenVaiTro: string } | null
  taiKhoan: {
    id: number
    tenDangNhap: string
    trangThai: boolean
    createdAt: string
    updatedAt: string | null
  } | null
}

interface EmployeeListResponse {
  users: EmployeeResponse[]
  pagination: PaginationMeta
}

interface EmployeeSingleResponse {
  user: EmployeeResponse
}

export interface EmployeeReference {
  id: number
  name: string
}

export interface EmployeeAccountSummary {
  id: number
  username: string
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface EmployeeSummary {
  id: number
  code: string
  fullName: string
  birthDate: string | null
  gender: number | null
  phone: string | null
  certificateCode: string | null
  certificateIssuedAt: string | null
  certificateExpiredAt: string | null
  isDeleted: boolean
  department: EmployeeReference | null
  position: EmployeeReference | null
  title: EmployeeReference | null
  role: EmployeeReference | null
  account: EmployeeAccountSummary | null
}

export interface GetEmployeesParams {
  page?: number
  limit?: number
  search?: string
  departmentId?: number
  roleId?: number
}

export interface UpdateEmployeePayload {
  maNV?: string
  hoTen?: string
  ngaySinh?: Date
  gioiTinh?: number
  sdt?: string
  soChungChiHanhNghe?: string
  ngayCapChungChi?: Date
  ngayHetHanChungChi?: Date
  daXoa?: boolean
  khoaId?: number
  chucDanhId?: number
  chucVuId?: number
  vaiTroId?: number
}

const mapReference = (
  value: { id: number; [key: string]: unknown } | null,
  labelKey: string,
): EmployeeReference | null => {
  if (!value || typeof value !== "object") {
    return null
  }

  const id = typeof value.id === "number" ? value.id : null
  const label = typeof value[labelKey] === "string" ? (value[labelKey] as string) : null

  if (id === null || label === null) {
    return null
  }

  return { id, name: label }
}

const mapEmployee = (employee: EmployeeResponse): EmployeeSummary => ({
  id: employee.id,
  code: employee.maNV,
  fullName: employee.hoTen,
  birthDate: employee.ngaySinh,
  gender: employee.gioiTinh,
  phone: employee.sdt,
  certificateCode: employee.soChungChiHanhNghe,
  certificateIssuedAt: employee.ngayCapChungChi,
  certificateExpiredAt: employee.ngayHetHanChungChi,
  isDeleted: employee.daXoa,
  department: mapReference(employee.khoa, "tenKhoa"),
  position: mapReference(employee.chucVu, "tenChucVu"),
  title: mapReference(employee.chucDanh, "tenChucDanh"),
  role: mapReference(employee.vaiTro, "tenVaiTro"),
  account: employee.taiKhoan
    ? {
        id: employee.taiKhoan.id,
        username: employee.taiKhoan.tenDangNhap,
        isActive: employee.taiKhoan.trangThai,
        createdAt: employee.taiKhoan.createdAt,
        updatedAt: employee.taiKhoan.updatedAt,
      }
    : null,
})

export const getEmployees = async (
  params: GetEmployeesParams = {},
): Promise<{ employees: EmployeeSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 10, search, departmentId, roleId } = params

  const queryParams: Record<string, unknown> = {
    page,
    limit,
  }

  if (search) {
    queryParams.search = search
  }

  if (typeof departmentId === "number") {
    queryParams.departmentId = departmentId
  }

  if (typeof roleId === "number") {
    queryParams.roleId = roleId
  }

  const response = await apiFetch<ApiSuccessResponse<EmployeeListResponse>>("/user", {
    method: "GET",
    params: queryParams,
  })

  const { users, pagination } = response.data

  return {
    employees: users.map(mapEmployee),
    pagination,
  }
}

export const updateEmployee = async (
  id: number,
  payload: UpdateEmployeePayload,
): Promise<EmployeeSummary> => {
  const response = await apiFetch<ApiSuccessResponse<EmployeeSingleResponse>>(`/user/${id}`, {
    method: "PUT",
    json: payload,
  })

  return mapEmployee(response.data.user)
}
