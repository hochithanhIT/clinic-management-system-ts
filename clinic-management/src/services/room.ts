import { apiFetch } from "./http"
import type { ApiSuccessResponse } from "./http"
import type { PaginationMeta } from "./types"

export interface RoomSummary {
  id: number
  name: string
  departmentId: number
  departmentName: string
}

interface RoomListResponse {
  rooms: Array<{
    id: number
    tenPhong: string
    khoa: {
      id: number
      tenKhoa: string
    }
  }>
  pagination: PaginationMeta
}

export interface GetRoomsParams {
  page?: number
  limit?: number
  search?: string
  departmentId?: number
}

export const getRooms = async (
  params: GetRoomsParams = {},
): Promise<{ rooms: RoomSummary[]; pagination: PaginationMeta }> => {
  const { page = 1, limit = 100, search, departmentId } = params

  const response = await apiFetch<ApiSuccessResponse<RoomListResponse>>("/room", {
    method: "GET",
    params: {
      page,
      limit,
      search,
      khoaId: departmentId,
    },
  })

  const { rooms, pagination } = response.data

  return {
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.tenPhong,
      departmentId: room.khoa.id,
      departmentName: room.khoa.tenKhoa,
    })),
    pagination,
  }
}
