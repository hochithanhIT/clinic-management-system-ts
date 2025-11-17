import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import referenceSchema, {
  referenceIdParam,
  roleBody,
  updateRoleBody,
} from "../validations/reference.schema";
import { z } from "zod";

const roleSelect = {
  id: true,
  tenVaiTro: true,
} satisfies Prisma.VaiTroSelect;

type GetRolesQuery = z.infer<typeof referenceSchema.paginationQuery>;
type AddRoleBody = z.infer<typeof roleBody>;
type UpdateRoleBody = z.infer<typeof updateRoleBody>;
type RoleParam = z.infer<typeof referenceIdParam>;

const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search }: GetRolesQuery =
      referenceSchema.paginationQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.VaiTroWhereInput = {};

    if (search) {
      where.tenVaiTro = { contains: search, mode: "insensitive" };
    }

    const [roles, total] = await Promise.all([
      prisma.vaiTro.findMany({
        where,
        select: roleSelect,
        skip,
        take: limit,
        orderBy: { tenVaiTro: "asc" },
      }),
      prisma.vaiTro.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      roles,
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

const addRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: AddRoleBody = roleBody.parse(req.body);

    const tenVaiTro = payload.tenVaiTro.trim();

    const existingRole = await prisma.vaiTro.findFirst({
      where: { tenVaiTro },
      select: { id: true },
    });

    if (existingRole) {
      return Send.badRequest(res, null, "Tên vai trò đã tồn tại");
    }

    const role = await prisma.vaiTro.create({
      data: { tenVaiTro },
      select: roleSelect,
    });

    return Send.success(res, { role }, "Tạo vai trò thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Vai trò đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: RoleParam = referenceIdParam.parse(req.params);
    const payload: UpdateRoleBody = updateRoleBody.parse(req.body);

    const existing = await prisma.vaiTro.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy vai trò");
    }

    const updateData: Prisma.VaiTroUpdateInput = {};

    if (payload.tenVaiTro !== undefined) {
      const tenVaiTro = payload.tenVaiTro.trim();

      const duplicate = await prisma.vaiTro.findFirst({
        where: {
          tenVaiTro,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return Send.badRequest(res, null, "Tên vai trò đã tồn tại");
      }

      updateData.tenVaiTro = tenVaiTro;
    }

    const role = await prisma.vaiTro.update({
      where: { id },
      data: updateData,
      select: roleSelect,
    });

    return Send.success(res, { role }, "Cập nhật vai trò thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Vai trò đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy vai trò");
      }
    }

    return next(error);
  }
};

const deleteRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: RoleParam = referenceIdParam.parse(req.params);

    await prisma.vaiTro.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa vai trò thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy vai trò");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa vai trò vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getRoles,
  addRole,
  updateRole,
  deleteRole,
};
