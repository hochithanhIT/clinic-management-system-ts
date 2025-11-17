import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import referenceSchema, {
  positionBody,
  referenceIdParam,
  updatePositionBody,
} from "../validations/reference.schema";
import { z } from "zod";

const positionSelect = {
  id: true,
  tenChucVu: true,
} satisfies Prisma.ChucVuSelect;

type GetPositionsQuery = z.infer<typeof referenceSchema.paginationQuery>;
type AddPositionBody = z.infer<typeof positionBody>;
type UpdatePositionBody = z.infer<typeof updatePositionBody>;
type PositionParam = z.infer<typeof referenceIdParam>;

const getPositions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search }: GetPositionsQuery =
      referenceSchema.paginationQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.ChucVuWhereInput = {};

    if (search) {
      where.tenChucVu = { contains: search, mode: "insensitive" };
    }

    const [positions, total] = await Promise.all([
      prisma.chucVu.findMany({
        where,
        select: positionSelect,
        skip,
        take: limit,
        orderBy: { tenChucVu: "asc" },
      }),
      prisma.chucVu.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      positions,
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

const addPosition = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddPositionBody = positionBody.parse(req.body);

    const tenChucVu = payload.tenChucVu.trim();

    const existing = await prisma.chucVu.findFirst({
      where: { tenChucVu },
      select: { id: true },
    });

    if (existing) {
      return Send.badRequest(res, null, "Tên chức vụ đã tồn tại");
    }

    const position = await prisma.chucVu.create({
      data: { tenChucVu },
      select: positionSelect,
    });

    return Send.success(
      res,
      { position },
      "Tạo chức vụ thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tên chức vụ đã tồn tại");
      }
    }

    return next(error);
  }
};

const updatePosition = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: PositionParam = referenceIdParam.parse(req.params);
    const payload: UpdatePositionBody = updatePositionBody.parse(req.body);

    const existing = await prisma.chucVu.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy chức vụ");
    }

    const updateData: Prisma.ChucVuUpdateInput = {};

    if (payload.tenChucVu !== undefined) {
      const tenChucVu = payload.tenChucVu.trim();

      const duplicate = await prisma.chucVu.findFirst({
        where: {
          tenChucVu,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return Send.badRequest(res, null, "Tên chức vụ đã tồn tại");
      }

      updateData.tenChucVu = tenChucVu;
    }

    const position = await prisma.chucVu.update({
      where: { id },
      data: updateData,
      select: positionSelect,
    });

    return Send.success(
      res,
      { position },
      "Cập nhật chức vụ thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tên chức vụ đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy chức vụ");
      }
    }

    return next(error);
  }
};

const deletePosition = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: PositionParam = referenceIdParam.parse(req.params);

    await prisma.chucVu.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa chức vụ thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy chức vụ");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa chức vụ vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getPositions,
  addPosition,
  updatePosition,
  deletePosition,
};
