import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface MedicalRecordPatient {
  id: number
  code: string
  fullName: string
  birthDate: string
  gender: number
  phone: string | null
  citizenId: string | null
  ward:
    | {
        id: number
        name: string
      }
    | null
  city:
    | {
        id: number
        name: string
      }
    | null
}

export interface MedicalStaffSummary {
  id: number
  name: string
  code: string
  department?: {
    id: number
    name: string
  } | null
}

export interface ClinicRoomSummary {
  id: number
  name: string
  department?: {
    id: number
    name: string
  } | null
}

export interface MedicalRecordSummary {
  id: number
  code: string
  enteredAt: string
  reason: string
  status: number
  completedAt: string | null
  patient: MedicalRecordPatient
  receiver: MedicalStaffSummary | null
  doctor: MedicalStaffSummary | null
  clinicRoom: ClinicRoomSummary | null
}

interface CreateMedicalRecordResponse {
  medicalRecord: {
    id: number
    maBA: string
    thoiGianVao: string
    lyDoKhamBenh: string
    trangThai: number
    thoiGianKetThuc: string | null
    benhNhan: {
      id: number
      maBenhNhan: string
      hoTen: string
      ngaySinh: string
      gioiTinh: number
      sdt: string | null
      cccd: string | null
      xaPhuong: {
        id: number
        tenXaPhuong: string
        tinhTP: {
          id: number
          tenTinhTP: string
        } | null
      } | null
    }
    nvTiepNhan: {
      id: number
      hoTen: string
      maNV: string
      khoa: {
        id: number
        tenKhoa: string
      } | null
    } | null
    nvKham: {
      id: number
      hoTen: string
      maNV: string
      khoa: {
        id: number
        tenKhoa: string
      } | null
    } | null
    phong: {
      id: number
      tenPhong: string
      khoa: {
        id: number
        tenKhoa: string
      } | null
    } | null
  }
}

interface GetMedicalRecordsResponse {
  medicalRecords: Array<
    CreateMedicalRecordResponse["medicalRecord"] & {
      benhNhan: CreateMedicalRecordResponse["medicalRecord"]["benhNhan"]
      nvTiepNhan: CreateMedicalRecordResponse["medicalRecord"]["nvTiepNhan"]
      nvKham: CreateMedicalRecordResponse["medicalRecord"]["nvKham"]
      phong: CreateMedicalRecordResponse["medicalRecord"]["phong"]
    }
  >
  pagination: PaginationMeta
}

export interface GetMedicalRecordsParams {
  page?: number
  limit?: number
  status?: number
  search?: string
  departmentId?: number
  patientId?: number
  roomId?: number
  enteredFrom?: string | Date
  enteredTo?: string | Date
}

export interface CreateMedicalRecordPayload {
  benhNhanId: number
  nvTiepNhanId: number
  thoiGianVao: string | Date
  lyDoKhamBenh: string
  maBA?: string
  nvKhamId?: number | null
  trangThai?: number
  thoiGianKetThuc?: string | Date | null
  phongId?: number | null
}

export interface UpdateMedicalRecordPayload {
  maBA?: string
  benhNhanId?: number
  nvTiepNhanId?: number
  nvKhamId?: number | null
  phongId?: number | null
  thoiGianVao?: string | Date
  lyDoKhamBenh?: string
  trangThai?: number
  thoiGianKetThuc?: string | Date | null
}

const serializeDateInput = (value: string | Date | null | undefined): string | null | undefined => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value ?? undefined
}

const serializeDateParam = (value: string | Date | null | undefined): string | undefined => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value ?? undefined
}

const mapClinicRoom = (
  room: CreateMedicalRecordResponse["medicalRecord"]["phong"] | null | undefined,
): ClinicRoomSummary | null => {
  if (!room) {
    return null
  }

  return {
    id: room.id,
    name: room.tenPhong,
    department: room.khoa
      ? {
          id: room.khoa.id,
          name: room.khoa.tenKhoa,
        }
      : null,
  }
}

export const createMedicalRecord = async (
  payload: CreateMedicalRecordPayload,
): Promise<MedicalRecordSummary> => {
  const requestBody: Record<string, unknown> = {
    benhNhanId: payload.benhNhanId,
    nvTiepNhanId: payload.nvTiepNhanId,
    thoiGianVao: serializeDateInput(payload.thoiGianVao)!,
    lyDoKhamBenh: payload.lyDoKhamBenh,
  }

  if (payload.maBA) {
    requestBody.maBA = payload.maBA
  }

  if (payload.nvKhamId !== undefined) {
    requestBody.nvKhamId = payload.nvKhamId
  }

  if (payload.trangThai !== undefined) {
    requestBody.trangThai = payload.trangThai
  }

  if (payload.thoiGianKetThuc !== undefined) {
    requestBody.thoiGianKetThuc = serializeDateInput(payload.thoiGianKetThuc)
  }

  if (payload.phongId !== undefined) {
    requestBody.phongId = payload.phongId
  }

  const response = await apiFetch<ApiSuccessResponse<CreateMedicalRecordResponse>>("/medical-record", {
    method: "POST",
    json: requestBody,
  })

  const { medicalRecord } = response.data

  const mapStaff = (staff: CreateMedicalRecordResponse["medicalRecord"]["nvTiepNhan"]): MedicalStaffSummary | null => {
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

  return {
    id: medicalRecord.id,
    code: medicalRecord.maBA,
    enteredAt: medicalRecord.thoiGianVao,
    reason: medicalRecord.lyDoKhamBenh,
    status: medicalRecord.trangThai,
    completedAt: medicalRecord.thoiGianKetThuc,
    patient: {
      id: medicalRecord.benhNhan.id,
      code: medicalRecord.benhNhan.maBenhNhan,
      fullName: medicalRecord.benhNhan.hoTen,
      birthDate: medicalRecord.benhNhan.ngaySinh,
      gender: medicalRecord.benhNhan.gioiTinh,
      phone: medicalRecord.benhNhan.sdt ?? null,
      citizenId: medicalRecord.benhNhan.cccd ?? null,
      ward: medicalRecord.benhNhan.xaPhuong
        ? {
            id: medicalRecord.benhNhan.xaPhuong.id,
            name: medicalRecord.benhNhan.xaPhuong.tenXaPhuong,
          }
        : null,
      city: medicalRecord.benhNhan.xaPhuong?.tinhTP
        ? {
            id: medicalRecord.benhNhan.xaPhuong.tinhTP.id,
            name: medicalRecord.benhNhan.xaPhuong.tinhTP.tenTinhTP,
          }
        : null,
    },
    receiver: mapStaff(medicalRecord.nvTiepNhan),
    doctor: mapStaff(medicalRecord.nvKham),
    clinicRoom: mapClinicRoom(medicalRecord.phong),
  }
}

export const updateMedicalRecord = async (
  medicalRecordId: number,
  payload: UpdateMedicalRecordPayload,
): Promise<MedicalRecordSummary> => {
  const requestBody: Record<string, unknown> = {}

  if (payload.maBA !== undefined) {
    requestBody.maBA = payload.maBA
  }

  if (payload.benhNhanId !== undefined) {
    requestBody.benhNhanId = payload.benhNhanId
  }

  if (payload.nvTiepNhanId !== undefined) {
    requestBody.nvTiepNhanId = payload.nvTiepNhanId
  }

  if (payload.nvKhamId !== undefined) {
    requestBody.nvKhamId = payload.nvKhamId
  }

  if (payload.phongId !== undefined) {
    requestBody.phongId = payload.phongId
  }

  if (payload.thoiGianVao !== undefined) {
    requestBody.thoiGianVao = serializeDateInput(payload.thoiGianVao)
  }

  if (payload.lyDoKhamBenh !== undefined) {
    requestBody.lyDoKhamBenh = payload.lyDoKhamBenh.trim()
  }

  if (payload.trangThai !== undefined) {
    requestBody.trangThai = payload.trangThai
  }

  if (payload.thoiGianKetThuc !== undefined) {
    requestBody.thoiGianKetThuc = serializeDateInput(payload.thoiGianKetThuc)
  }

  const response = await apiFetch<ApiSuccessResponse<{ medicalRecord: GetMedicalRecordsResponse["medicalRecords"][number] }>>(
    `/medical-record/${medicalRecordId}`,
    {
      method: "PUT",
      json: requestBody,
    },
  )

  const { medicalRecord } = response.data

  return mapMedicalRecord(medicalRecord)
}

const mapMedicalRecord = (record: GetMedicalRecordsResponse["medicalRecords"][number]): MedicalRecordSummary => {
  const mapStaff = (
    staff: CreateMedicalRecordResponse["medicalRecord"]["nvTiepNhan"],
  ): MedicalStaffSummary | null => {
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

  return {
    id: record.id,
    code: record.maBA,
    enteredAt: record.thoiGianVao,
    reason: record.lyDoKhamBenh,
    status: record.trangThai,
    completedAt: record.thoiGianKetThuc,
    patient: {
      id: record.benhNhan.id,
      code: record.benhNhan.maBenhNhan,
      fullName: record.benhNhan.hoTen,
      birthDate: record.benhNhan.ngaySinh,
      gender: record.benhNhan.gioiTinh,
      phone: record.benhNhan.sdt ?? null,
      citizenId: record.benhNhan.cccd ?? null,
      ward: record.benhNhan.xaPhuong
        ? {
            id: record.benhNhan.xaPhuong.id,
            name: record.benhNhan.xaPhuong.tenXaPhuong,
          }
        : null,
      city: record.benhNhan.xaPhuong?.tinhTP
        ? {
            id: record.benhNhan.xaPhuong.tinhTP.id,
            name: record.benhNhan.xaPhuong.tinhTP.tenTinhTP,
          }
        : null,
    },
    receiver: mapStaff(record.nvTiepNhan),
    doctor: mapStaff(record.nvKham),
    clinicRoom: mapClinicRoom(record.phong),
  }
}

export const getMedicalRecords = async (
  params: GetMedicalRecordsParams = {},
): Promise<{ medicalRecords: MedicalRecordSummary[]; pagination: PaginationMeta }> => {
  const {
    page = 1,
    limit = 100,
    status,
    search,
    departmentId,
    patientId,
    roomId,
    enteredFrom,
    enteredTo,
  } = params

  const response = await apiFetch<ApiSuccessResponse<GetMedicalRecordsResponse>>("/medical-record", {
    method: "GET",
    params: {
      page,
      limit,
      status,
      search,
      departmentId,
      patientId,
      roomId,
      enteredFrom: serializeDateParam(enteredFrom),
      enteredTo: serializeDateParam(enteredTo),
    },
  })

  const { medicalRecords, pagination } = response.data

  return {
    medicalRecords: medicalRecords.map(mapMedicalRecord),
    pagination,
  }
}
