import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import roomSchema from "../validations/room.schema";
import { z } from "zod";

const roomSelect = {
  id: true,
  tenPhong: true,
  khoa: {
    select: {
      id: true,
      tenKhoa: true,
    },
  },
} satisfies Prisma.PhongSelect;

type GetRoomsQuery = z.infer<typeof roomSchema.getRoomsQuery>;
type RoomParam = z.infer<typeof roomSchema.roomParam>;
type AddRoomBody = z.infer<typeof roomSchema.addRoomBody>;
type UpdateRoomBody = z.infer<typeof roomSchema.updateRoomBody>;

type RoomResult = Prisma.PhongGetPayload<{ select: typeof roomSelect }>;

const mapRoom = (room: RoomResult) => ({
  id: room.id,
  tenPhong: room.tenPhong,
  khoa: room.khoa,
});

const getRooms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, search, khoaId }: GetRoomsQuery =
      roomSchema.getRoomsQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.PhongWhereInput = {};

    if (search) {
      where.tenPhong = { contains: search, mode: "insensitive" };
    }

    if (khoaId !== undefined) {
      where.khoaId = khoaId;
    }

    const [rooms, total] = await Promise.all([
      prisma.phong.findMany({
        where,
        select: roomSelect,
        skip,
        take: limit,
        orderBy: { id: "asc" },
      }),
      prisma.phong.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      rooms: rooms.map(mapRoom),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const addRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload: AddRoomBody = roomSchema.addRoomBody.parse(req.body);

    const tenPhong = payload.tenPhong.trim();

    const department = await prisma.khoa.findUnique({
      where: { id: payload.khoaId },
      select: { id: true },
    });

    if (!department) {
      return Send.badRequest(res, null, "Khoa không tồn tại");
    }

    const duplicateRoom = await prisma.phong.findFirst({
      where: {
        tenPhong,
        khoaId: payload.khoaId,
      },
      select: { id: true },
    });

    if (duplicateRoom) {
      return Send.badRequest(res, null, "Phòng đã tồn tại trong khoa này");
    }

    const room = await prisma.phong.create({
      data: {
        tenPhong,
        khoa: { connect: { id: payload.khoaId } },
      },
      select: roomSelect,
    });

    return Send.success(res, { room: mapRoom(room) }, "Tạo phòng thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Phòng đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: RoomParam = roomSchema.roomParam.parse(req.params);
    const payload: UpdateRoomBody = roomSchema.updateRoomBody.parse(req.body);

    const existingRoom = await prisma.phong.findUnique({
      where: { id },
      select: { id: true, khoaId: true },
    });

    if (!existingRoom) {
      return Send.notFound(res, null, "Không tìm thấy phòng");
    }

    const updateData: Prisma.PhongUpdateInput = {};

    let targetDepartmentId = existingRoom.khoaId;

    if (payload.khoaId !== undefined) {
      const department = await prisma.khoa.findUnique({
        where: { id: payload.khoaId },
        select: { id: true },
      });

      if (!department) {
        return Send.badRequest(res, null, "Khoa không tồn tại");
      }

      targetDepartmentId = payload.khoaId;
      updateData.khoa = { connect: { id: payload.khoaId } };
    }

    if (payload.tenPhong !== undefined) {
      const tenPhong = payload.tenPhong.trim();

      const duplicateRoom = await prisma.phong.findFirst({
        where: {
          tenPhong,
          khoaId: targetDepartmentId,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicateRoom) {
        return Send.badRequest(res, null, "Phòng đã tồn tại trong khoa này");
      }

      updateData.tenPhong = tenPhong;
    }

    const room = await prisma.phong.update({
      where: { id },
      data: updateData,
      select: roomSelect,
    });

    return Send.success(res, { room: mapRoom(room) }, "Cập nhật phòng thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Phòng đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phòng");
      }
    }

    return next(error);
  }
};

const deleteRoom = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: RoomParam = roomSchema.roomParam.parse(req.params);

    await prisma.phong.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa phòng thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phòng");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Không thể xóa phòng vì đang được sử dụng");
      }
    }

    return next(error);
  }
};

export default {
  getRooms,
  addRoom,
  updateRoom,
  deleteRoom,
};
