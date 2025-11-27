import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"

export interface MedicalRecordPatient {
  id: number
  code: string
  fullName: string
  birthDate: string
  gender: number
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
  }
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
}

const serializeDateInput = (value: string | Date | null | undefined): string | null | undefined => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value ?? undefined
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
    },
    receiver: mapStaff(medicalRecord.nvTiepNhan),
    doctor: mapStaff(medicalRecord.nvKham),
  }
}
