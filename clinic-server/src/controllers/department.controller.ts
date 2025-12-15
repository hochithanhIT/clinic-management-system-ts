import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import departmentSchema from "../validations/department.schema";
import { z } from "zod";

const departmentSelect = {
  id: true,
  tenKhoa: true,
  isActive: true,
  phongs: {
    where: { isActive: true },
    select: { id: true },
  },
} satisfies Prisma.KhoaSelect;

type GetDepartmentsQuery = z.infer<
  typeof departmentSchema.getDepartmentsQuery
>;
type DepartmentParam = z.infer<typeof departmentSchema.departmentParam>;
type AddDepartmentBody = z.infer<typeof departmentSchema.addDepartmentBody>;
type UpdateDepartmentBody = z.infer<
  typeof departmentSchema.updateDepartmentBody
>;

type DepartmentResult = Prisma.KhoaGetPayload<{
  select: typeof departmentSelect;
}>;

const mapDepartment = (department: DepartmentResult) => ({
  id: department.id,
  tenKhoa: department.tenKhoa,
  isActive: department.isActive,
  soPhong: department.phongs.length,
});

const getDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, search, status }: GetDepartmentsQuery =
      departmentSchema.getDepartmentsQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const effectiveStatus = status === "inactive" ? "inactive" : "active";
    const where: Prisma.KhoaWhereInput = {
      isActive: effectiveStatus === "active",
    };

    if (search) {
      where.tenKhoa = { contains: search, mode: "insensitive" };
    }

    const [departments, total] = await Promise.all([
      prisma.khoa.findMany({
        where,
        select: departmentSelect,
        skip,
        take: limit,
        orderBy: { id: "asc" },
      }),
      prisma.khoa.count({ where }),
    ]);

    const normalized = departments.map(mapDepartment);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      departments: normalized,
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

const addDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload: AddDepartmentBody =
      departmentSchema.addDepartmentBody.parse(req.body);

    const tenKhoa = payload.tenKhoa.trim();

    const existingDepartment = await prisma.khoa.findFirst({
      where: { tenKhoa },
      select: { id: true },
    });

    if (existingDepartment) {
      return Send.badRequest(res, null, "Tên khoa đã tồn tại");
    }

    const createdDepartment = await prisma.khoa.create({
      data: { tenKhoa },
      select: departmentSelect,
    });

    return Send.success(
      res,
      { department: mapDepartment(createdDepartment) },
      "Tạo khoa thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tên khoa đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: DepartmentParam = departmentSchema.departmentParam.parse(
      req.params,
    );
    const payload: UpdateDepartmentBody =
      departmentSchema.updateDepartmentBody.parse(req.body);

    const existingDepartment = await prisma.khoa.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingDepartment) {
      return Send.notFound(res, null, "Không tìm thấy khoa");
    }

    const updateData: Prisma.KhoaUpdateInput = {};

    if (payload.tenKhoa !== undefined) {
      const tenKhoa = payload.tenKhoa.trim();

      const duplicateDepartment = await prisma.khoa.findFirst({
        where: {
          tenKhoa,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicateDepartment) {
        return Send.badRequest(res, null, "Tên khoa đã tồn tại");
      }

      updateData.tenKhoa = tenKhoa;
    }

    const updatedDepartment = await prisma.khoa.update({
      where: { id },
      data: updateData,
      select: departmentSelect,
    });

    return Send.success(
      res,
      { department: mapDepartment(updatedDepartment) },
      "Cập nhật khoa thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tên khoa đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy khoa");
      }
    }

    return next(error);
  }
};

const deleteDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: DepartmentParam = departmentSchema.departmentParam.parse(
      req.params,
    );

    const existingDepartment = await prisma.khoa.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existingDepartment || !existingDepartment.isActive) {
      return Send.notFound(res, null, "Không tìm thấy khoa");
    }

    await prisma.$transaction([
      prisma.phong.updateMany({
        where: { khoaId: id },
        data: { isActive: false },
      }),
      prisma.khoa.update({
        where: { id },
        data: { isActive: false },
      }),
    ]);

    return Send.success(res, null, "Xóa khoa thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa khoa vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

const restoreDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: DepartmentParam = departmentSchema.departmentParam.parse(
      req.params,
    );

    const existingDepartment = await prisma.khoa.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existingDepartment) {
      return Send.notFound(res, null, "Không tìm thấy khoa");
    }

    if (existingDepartment.isActive) {
      return Send.badRequest(res, null, "Khoa đang hoạt động");
    }

    await prisma.$transaction([
      prisma.khoa.update({
        where: { id },
        data: { isActive: true },
      }),
      prisma.phong.updateMany({
        where: { khoaId: id },
        data: { isActive: true },
      }),
    ]);

    return Send.success(res, null, "Khôi phục khoa thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy khoa");
      }
    }

    return next(error);
  }
};

export default {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  restoreDepartment,
};
