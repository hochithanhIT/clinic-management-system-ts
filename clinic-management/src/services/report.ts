import { apiFetch, type ApiSuccessResponse } from "./http"

interface NurseReceptionReportResponse {
  totalAdmissions: number
  admissionsByStaff: Array<{
    staffId: number
    staffCode: string
    staffName: string
    totalAdmissions: number
  }>
  timeline: Record<
    "day" | "week" | "month" | "year",
    Array<{
      date: string
      totalAdmissions: number
    }>
  >
  detailRange: "day" | "week" | "month" | "year"
}

interface DoctorSummaryResponse {
  totalPatients: number
  patients: Array<{
    visitId: number
    patientId: number
    patientCode: string
    patientName: string
    examinedAt: string
  }>
  range: "day" | "week" | "month" | "year"
}

export interface NurseReceptionReport {
  totalAdmissions: number
  admissionsByStaff: Array<{
    staffId: number
    staffCode: string
    staffName: string
    totalAdmissions: number
  }>
  timeline: Record<
    "day" | "week" | "month" | "year",
    Array<{
      date: string
      totalAdmissions: number
    }>
  >
  detailRange: "day" | "week" | "month" | "year"
}

export interface DoctorSummary {
  totalPatients: number
  patients: Array<{
    visitId: number
    patientId: number
    patientCode: string
    patientName: string
    examinedAt: string
  }>
  range: "day" | "week" | "month" | "year"
}

export const getNurseReceptionReport = async (params?: {
  detailRange?: "day" | "week" | "month" | "year"
}): Promise<NurseReceptionReport> => {
  const searchParams = new URLSearchParams()

  if (params?.detailRange) {
    searchParams.set("detailsRange", params.detailRange)
  }

  const query = searchParams.toString()
  const url = `/report/nurse-reception${query ? `?${query}` : ""}`

  const response = await apiFetch<ApiSuccessResponse<NurseReceptionReportResponse>>(url, {
    method: "GET",
  })

  return {
    totalAdmissions: response.data.totalAdmissions,
    admissionsByStaff: response.data.admissionsByStaff.map((item) => ({
      staffId: item.staffId,
      staffCode: item.staffCode,
      staffName: item.staffName,
      totalAdmissions: item.totalAdmissions,
    })),
    timeline: {
      day: response.data.timeline.day.map((point) => ({
        date: point.date,
        totalAdmissions: point.totalAdmissions,
      })),
      week: response.data.timeline.week.map((point) => ({
        date: point.date,
        totalAdmissions: point.totalAdmissions,
      })),
      month: response.data.timeline.month.map((point) => ({
        date: point.date,
        totalAdmissions: point.totalAdmissions,
      })),
      year: response.data.timeline.year.map((point) => ({
        date: point.date,
        totalAdmissions: point.totalAdmissions,
      })),
    },
    detailRange: response.data.detailRange,
  }
}

export const getDoctorSummary = async (params?: {
  range?: "day" | "week" | "month" | "year"
}): Promise<DoctorSummary> => {
  const searchParams = new URLSearchParams()

  if (params?.range) {
    searchParams.set("range", params.range)
  }

  const query = searchParams.toString()
  const url = `/report/doctor-summary${query ? `?${query}` : ""}`

  const response = await apiFetch<ApiSuccessResponse<DoctorSummaryResponse>>(url, {
    method: "GET",
  })

  return {
    totalPatients: response.data.totalPatients,
    patients: response.data.patients.map((item) => ({
      visitId: item.visitId,
      patientId: item.patientId,
      patientCode: item.patientCode,
      patientName: item.patientName,
      examinedAt: item.examinedAt,
    })),
    range: response.data.range,
  }
}
