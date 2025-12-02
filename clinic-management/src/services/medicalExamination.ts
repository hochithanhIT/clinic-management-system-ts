import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"

interface MedicalExaminationDiagnosisResponse {
  benhId: number
  benhChinh: boolean
  benh: {
    id: number
    maICD10: string
    tenBenh: string
  } | null
}

interface MedicalExaminationResponse {
  id: number
  maPhieu: string
  thoiGianKham: string
  quaTrinhBenhLy: string | null
  tienSuBanThan: string | null
  tienSuGiaDinh: string | null
  khamToanThan: string | null
  khamBoPhan: string | null
  mach: number | null
  nhietDo: number | null
  nhipTho: number | null
  canNang: number | null
  chieuCao: number | null
  huyetApTThu: number | null
  huyetApTTr: number | null
  bmi: number | null
  chanDoanBanDau: string | null
  phuongPhapDieuTri: string | null
  xuTri: string | null
  chanDoans: MedicalExaminationDiagnosisResponse[]
}

export interface MedicalExaminationDiagnosis {
  diseaseId: number
  isPrimary: boolean
  disease?: {
    id: number
    code: string
    name: string
  } | null
}

export interface MedicalExaminationDetail {
  id: number
  code: string
  examTime: string
  generalAssessment: string | null
  systemAssessment: string | null
  pulse: number | null
  temperature: number | null
  respiratoryRate: number | null
  weight: number | null
  height: number | null
  systolicBloodPressure: number | null
  diastolicBloodPressure: number | null
  bmi: number | null
  initialDiagnosis: string | null
  diseaseProgression: string | null
  personalHistory: string | null
  familyHistory: string | null
  diagnoses: MedicalExaminationDiagnosis[]
}

export interface CreateMedicalExaminationPayload {
  benhAnId: number
  thoiGianKham: string | Date
  quaTrinhBenhLy?: string | null
  tienSuBanThan?: string | null
  tienSuGiaDinh?: string | null
  khamToanThan?: string | null
  khamBoPhan?: string | null
  mach?: number | null
  nhietDo?: number | null
  nhipTho?: number | null
  canNang?: number | null
  chieuCao?: number | null
  huyetApTThu?: number | null
  huyetApTTr?: number | null
  bmi?: number | null
  chanDoanBanDau?: string | null
}

export interface UpdateMedicalExaminationPayload {
  benhAnId?: number
  thoiGianKham?: string | Date
  quaTrinhBenhLy?: string | null
  tienSuBanThan?: string | null
  tienSuGiaDinh?: string | null
  khamToanThan?: string | null
  khamBoPhan?: string | null
  mach?: number | null
  nhietDo?: number | null
  nhipTho?: number | null
  canNang?: number | null
  chieuCao?: number | null
  huyetApTThu?: number | null
  huyetApTTr?: number | null
  bmi?: number | null
  chanDoanBanDau?: string | null
}

export interface UpdateMedicalExaminationDiagnosisPayload {
  diagnoses: Array<{ diseaseId: number; isPrimary: boolean }>
}

const serializeDateInput = (value: string | Date | undefined): string | undefined => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value ?? undefined
}

const mapDiagnoses = (diagnoses: MedicalExaminationDiagnosisResponse[]): MedicalExaminationDiagnosis[] => {
  return diagnoses.map((diagnosis) => ({
    diseaseId: diagnosis.benhId,
    isPrimary: diagnosis.benhChinh,
    disease: diagnosis.benh
      ? {
          id: diagnosis.benh.id,
          code: diagnosis.benh.maICD10,
          name: diagnosis.benh.tenBenh,
        }
      : null,
  }))
}

const mapMedicalExamination = (exam: MedicalExaminationResponse): MedicalExaminationDetail => ({
  id: exam.id,
  code: exam.maPhieu,
  examTime: exam.thoiGianKham,
  generalAssessment: exam.khamToanThan,
  systemAssessment: exam.khamBoPhan,
  pulse: exam.mach,
  temperature: exam.nhietDo,
  respiratoryRate: exam.nhipTho,
  weight: exam.canNang,
  height: exam.chieuCao,
  systolicBloodPressure: exam.huyetApTThu,
  diastolicBloodPressure: exam.huyetApTTr,
  bmi: exam.bmi,
  initialDiagnosis: exam.chanDoanBanDau,
  diseaseProgression: exam.quaTrinhBenhLy,
  personalHistory: exam.tienSuBanThan,
  familyHistory: exam.tienSuGiaDinh,
  diagnoses: mapDiagnoses(exam.chanDoans ?? []),
})

export const getMedicalExaminationByMedicalRecord = async (
  medicalRecordId: number,
): Promise<MedicalExaminationDetail | null> => {
  const response = await apiFetch<
    ApiSuccessResponse<{ medicalExamination: MedicalExaminationResponse | null }>
  >(`/medical-examination/medical-record/${medicalRecordId}`)

  const examination = response.data.medicalExamination
  if (!examination) {
    return null
  }

  return mapMedicalExamination(examination)
}

export const createMedicalExamination = async (
  payload: CreateMedicalExaminationPayload,
): Promise<MedicalExaminationDetail> => {
  const response = await apiFetch<
    ApiSuccessResponse<{ medicalExamination: MedicalExaminationResponse }>
  >("/medical-examination", {
    method: "POST",
    json: {
      ...payload,
      thoiGianKham: serializeDateInput(payload.thoiGianKham),
    },
  })

  return mapMedicalExamination(response.data.medicalExamination)
}

export const updateMedicalExamination = async (
  examinationId: number,
  payload: UpdateMedicalExaminationPayload,
): Promise<MedicalExaminationDetail> => {
  const response = await apiFetch<
    ApiSuccessResponse<{ medicalExamination: MedicalExaminationResponse }>
  >(`/medical-examination/${examinationId}`, {
    method: "PUT",
    json: {
      ...payload,
      thoiGianKham: serializeDateInput(payload.thoiGianKham),
    },
  })

  return mapMedicalExamination(response.data.medicalExamination)
}

export const updateMedicalExaminationDiagnoses = async (
  examinationId: number,
  payload: UpdateMedicalExaminationDiagnosisPayload,
): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>(`/medical-examination/${examinationId}/diagnosis`, {
    method: "PUT",
    json: {
      diagnoses: payload.diagnoses.map((diagnosis) => ({
        benhId: diagnosis.diseaseId,
        benhChinh: diagnosis.isPrimary,
      })),
    },
  })
}
