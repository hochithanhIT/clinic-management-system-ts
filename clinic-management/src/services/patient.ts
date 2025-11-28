import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"

export interface PatientOccupation {
  id: number
  name: string
}

export interface PatientCity {
  id: number
  name: string
}

export interface PatientWard {
  id: number
  name: string
  city: PatientCity | null
}

export interface PatientSummary {
  id: number
  code: string
  fullName: string
  birthDate: string
  gender: number
  phone: string | null
  citizenId: string | null
  relativeName: string | null
  relativePhone: string | null
  relation: string | null
  occupation: PatientOccupation | null
  ward: PatientWard | null
}

interface CreatePatientResponse {
  patient: {
    id: number
    maBenhNhan: string
    hoTen: string
    ngaySinh: string
    gioiTinh: number
    sdt: string | null
    cccd: string | null
    hoTenNguoiNha: string | null
    sdtNguoiNha: string | null
    quanHe: string | null
    ngheNghiep: {
      id: number
      tenNgheNghiep: string
    } | null
    xaPhuong: {
      id: number
      tenXaPhuong: string
      tinhTP: {
        id: number
        tenTinhTP: string
      } | null
    } | null
  }
}

type PatientResponseData = CreatePatientResponse["patient"]

interface PatientResponse {
  patient: PatientResponseData
}

const mapPatient = (patient: PatientResponseData): PatientSummary => {
  return {
    id: patient.id,
    code: patient.maBenhNhan,
    fullName: patient.hoTen,
    birthDate: patient.ngaySinh,
    gender: patient.gioiTinh,
    phone: patient.sdt,
    citizenId: patient.cccd,
    relativeName: patient.hoTenNguoiNha,
    relativePhone: patient.sdtNguoiNha,
    relation: patient.quanHe,
    occupation: patient.ngheNghiep
      ? {
          id: patient.ngheNghiep.id,
          name: patient.ngheNghiep.tenNgheNghiep,
        }
      : null,
    ward: patient.xaPhuong
      ? {
          id: patient.xaPhuong.id,
          name: patient.xaPhuong.tenXaPhuong,
          city: patient.xaPhuong.tinhTP
            ? {
                id: patient.xaPhuong.tinhTP.id,
                name: patient.xaPhuong.tinhTP.tenTinhTP,
              }
            : null,
        }
      : null,
  }
}

export interface CreatePatientPayload {
  hoTen: string
  ngaySinh: string
  gioiTinh: number
  ngheNghiepId: number
  xaPhuongId: number
  maBenhNhan?: string
  sdt?: string
  cccd?: string
  hoTenNguoiNha?: string
  sdtNguoiNha?: string
  quanHe?: string
}

export const createPatient = async (payload: CreatePatientPayload): Promise<PatientSummary> => {
  const response = await apiFetch<ApiSuccessResponse<CreatePatientResponse>>("/patient", {
    method: "POST",
    json: payload,
  })

  return mapPatient(response.data.patient)
}

export const deletePatient = async (patientId: number): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>(`/patient/${patientId}`, {
    method: "DELETE",
  })
}

export const getPatient = async (patientId: number): Promise<PatientSummary> => {
  const response = await apiFetch<ApiSuccessResponse<PatientResponse>>(`/patient/${patientId}`, {
    method: "GET",
  })

  return mapPatient(response.data.patient)
}

export interface UpdatePatientPayload {
  maBenhNhan?: string
  hoTen?: string
  ngaySinh?: string
  gioiTinh?: number
  ngheNghiepId?: number
  xaPhuongId?: number
  sdt?: string
  cccd?: string
  hoTenNguoiNha?: string
  sdtNguoiNha?: string
  quanHe?: string
}

export const updatePatient = async (
  patientId: number,
  payload: UpdatePatientPayload,
): Promise<PatientSummary> => {
  const response = await apiFetch<ApiSuccessResponse<PatientResponse>>(`/patient/${patientId}`, {
    method: "PUT",
    json: payload,
  })

  return mapPatient(response.data.patient)
}
