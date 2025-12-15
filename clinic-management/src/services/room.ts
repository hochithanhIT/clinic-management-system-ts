import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface RoomSummary {
  id: number
  name: string
  departmentId: number
  departmentName: string
  isActive: boolean
}

interface RoomListResponse {
  rooms: Array<{
    id: number
    tenPhong: string
    isActive: boolean
    khoa: {
      id: number
      tenKhoa: string
    }
  }>
  pagination: PaginationMeta
}

interface RoomResponse {
  room: {
    id: number
    tenPhong: string
    isActive: boolean
    khoa: {
      id: number
      tenKhoa: string
    }
  }
}

export interface GetRoomsParams {
  page?: number
  limit?: number
  search?: string
  departmentId?: number
  status?: "active" | "inactive"
}

export const getRooms = async (
  params: GetRoomsParams = {},
): Promise<{ rooms: RoomSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search, departmentId, status } = params

  const response = await apiFetch<ApiSuccessResponse<RoomListResponse>>("/room", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      khoaId: departmentId,
      status,
    },
  })

  const { rooms, pagination } = response.data

  return {
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.tenPhong,
      departmentId: room.khoa.id,
      departmentName: room.khoa.tenKhoa,
      isActive: room.isActive,
    })),
    pagination,
  }
}

export interface UpdateRoomPayload {
  name?: string
  departmentId?: number
}

export interface CreateRoomPayload {
  name: string
  departmentId: number
}

export const createRoom = async (
  payload: CreateRoomPayload,
): Promise<RoomSummary> => {
  const response = await apiFetch<ApiSuccessResponse<RoomResponse>>("/room", {
    method: "POST",
    json: {
      tenPhong: payload.name.trim(),
      khoaId: payload.departmentId,
    },
  })

  const { room } = response.data

  return {
    id: room.id,
    name: room.tenPhong,
    departmentId: room.khoa.id,
    departmentName: room.khoa.tenKhoa,
    isActive: room.isActive,
  }
}

export const updateRoom = async (
  id: number,
  payload: UpdateRoomPayload,
): Promise<RoomSummary> => {
  const body: Record<string, unknown> = {}

  if (payload.name !== undefined) {
    body.tenPhong = payload.name.trim()
  }

  if (payload.departmentId !== undefined) {
    body.khoaId = payload.departmentId
  }

  const response = await apiFetch<ApiSuccessResponse<RoomResponse>>(`/room/${id}`, {
    method: "PUT",
    json: body,
  })

  const { room } = response.data

  return {
    id: room.id,
    name: room.tenPhong,
    departmentId: room.khoa.id,
    departmentName: room.khoa.tenKhoa,
    isActive: room.isActive,
  }
}

export const deleteRoom = async (id: number): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>(`/room/${id}`, {
    method: "DELETE",
  })
}

export const restoreRoom = async (id: number): Promise<void> => {
  await apiFetch<ApiSuccessResponse<null>>(`/room/${id}/restore`, {
    method: "PATCH",
  })
}
