import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

interface AppointmentResponse {
  appointment: {
    id: number
    scheduledAt: string
    reason: string
    notes: string | null
    phong: {
      id: number
      tenPhong: string
      khoa: {
        id: number
        tenKhoa: string
      } | null
    } | null
    benhNhan: {
      id: number
      maBenhNhan: string
      hoTen: string
    } | null
  }
}

interface AppointmentListResponse {
  appointments: AppointmentResponse["appointment"][]
  pagination: PaginationMeta
}

export interface AppointmentSummary {
  id: number
  scheduledAt: string
  reason: string
  notes: string | null
  room: {
    id: number
    name: string
    departmentId: number | null
    departmentName: string | null
  } | null
  patient: {
    id: number
    code: string
    fullName: string
  } | null
}

export interface GetAppointmentsParams {
  page?: number
  limit?: number
  patientId?: number
  roomId?: number
  from?: string | Date
  to?: string | Date
}

export interface CreateAppointmentPayload {
  patientId: number
  roomId: number
  scheduledAt: string | Date
  reason: string
  notes?: string | null
}

export interface UpdateAppointmentPayload {
  scheduledAt?: string | Date
  reason?: string
  roomId?: number
  notes?: string | null
}

const serializeDate = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

const normalizeOptionalText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const mapAppointment = (appointment: AppointmentResponse["appointment"]): AppointmentSummary => ({
  id: appointment.id,
  scheduledAt: appointment.scheduledAt,
  reason: appointment.reason,
  notes: appointment.notes,
  room: appointment.phong
    ? {
        id: appointment.phong.id,
        name: appointment.phong.tenPhong,
        departmentId: appointment.phong.khoa ? appointment.phong.khoa.id : null,
        departmentName: appointment.phong.khoa ? appointment.phong.khoa.tenKhoa : null,
      }
    : null,
  patient: appointment.benhNhan
    ? {
        id: appointment.benhNhan.id,
        code: appointment.benhNhan.maBenhNhan,
        fullName: appointment.benhNhan.hoTen,
      }
    : null,
})

export const getAppointments = async (
  params: GetAppointmentsParams = {},
): Promise<{ appointments: AppointmentSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 20, patientId, roomId, from, to } = params

  const response = await apiFetch<ApiSuccessResponse<AppointmentListResponse>>("/appointment", {
    method: "GET",
    params: {
      page,
      limit,
      benhNhanId: patientId,
      phongId: roomId,
      from: from instanceof Date ? from.toISOString() : from,
      to: to instanceof Date ? to.toISOString() : to,
    },
  })

  const { appointments, pagination } = response.data

  return {
    appointments: appointments.map(mapAppointment),
    pagination,
  }
}

export const createAppointment = async (
  payload: CreateAppointmentPayload,
): Promise<AppointmentSummary> => {
  const response = await apiFetch<ApiSuccessResponse<AppointmentResponse>>("/appointment", {
    method: "POST",
    json: {
      benhNhanId: payload.patientId,
      phongId: payload.roomId,
      scheduledAt: serializeDate(payload.scheduledAt),
      reason: payload.reason.trim(),
      notes: normalizeOptionalText(payload.notes),
    },
  })

  return mapAppointment(response.data.appointment)
}

export const updateAppointment = async (
  id: number,
  payload: UpdateAppointmentPayload,
): Promise<AppointmentSummary> => {
  const body: Record<string, unknown> = {}

  if (payload.scheduledAt !== undefined) {
    body.scheduledAt = serializeDate(payload.scheduledAt)
  }

  if (payload.reason !== undefined) {
    body.reason = payload.reason.trim()
  }

  if (payload.roomId !== undefined) {
    body.phongId = payload.roomId
  }

  if (payload.notes !== undefined) {
    body.notes = normalizeOptionalText(payload.notes)
  }

  const response = await apiFetch<ApiSuccessResponse<AppointmentResponse>>(`/appointment/${id}`, {
    method: "PUT",
    json: body,
  })

  return mapAppointment(response.data.appointment)
}

export const deleteAppointment = async (id: number): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>(`/appointment/${id}`, {
    method: "DELETE",
  })
}
