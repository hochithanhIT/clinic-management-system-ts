import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import serviceGroupSchema from "../validations/service-group.schema";
import { z } from "zod";

const serviceGroupSelect = {
  id: true,
  tenNhomDV: true,
  loaiDichVu: {
    select: {
      id: true,
      tenLoai: true,
    },
  },
} satisfies Prisma.NhomDichVuSelect;

const serviceGroupDetailSelect = {
  id: true,
  tenNhomDV: true,
  loaiDichVu: {
    select: {
      id: true,
      tenLoai: true,
    },
  },
  dichVus: {
    select: {
      id: true,
      tenDV: true,
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.NhomDichVuSelect;

type AddServiceGroupBody = z.infer<typeof serviceGroupSchema.addServiceGroupBody>;
type UpdateServiceGroupBody = z.infer<typeof serviceGroupSchema.updateServiceGroupBody>;
type ServiceGroupParam = z.infer<typeof serviceGroupSchema.serviceGroupParam>;
type GetServiceGroupsQuery = z.infer<
  typeof serviceGroupSchema.getServiceGroupsQuery
>;

type ServiceGroupResult = Prisma.NhomDichVuGetPayload<{ select: typeof serviceGroupSelect }>;
type ServiceGroupDetailResult = Prisma.NhomDichVuGetPayload<{
  select: typeof serviceGroupDetailSelect;
}>;

const mapServiceGroup = (group: ServiceGroupResult) => ({
  id: group.id,
  tenNhomDV: group.tenNhomDV,
  loaiDichVu: group.loaiDichVu,
});

const mapServiceGroupDetail = (group: ServiceGroupDetailResult) => ({
  id: group.id,
  tenNhomDV: group.tenNhomDV,
  loaiDichVu: group.loaiDichVu,
  dichVus: group.dichVus.map((service) => ({
    id: service.id,
    tenDV: service.tenDV,
  })),
});

const getServiceGroups = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, loaiDichVuId }: GetServiceGroupsQuery =
      serviceGroupSchema.getServiceGroupsQuery.parse(req.query);

    const skip = (page - 1) * limit;

    const where: Prisma.NhomDichVuWhereInput = {};

    if (search) {
      where.tenNhomDV = { contains: search, mode: "insensitive" };
    }

    if (loaiDichVuId !== undefined) {
      where.ldvId = loaiDichVuId;
    }

    const [groups, total] = await Promise.all([
      prisma.nhomDichVu.findMany({
        where,
        select: serviceGroupSelect,
        skip,
        take: limit,
        orderBy: { id: "asc" },
      }),
      prisma.nhomDichVu.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      serviceGroups: groups.map(mapServiceGroup),
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

const getServiceGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceGroupParam = serviceGroupSchema.serviceGroupParam.parse(
      req.params,
    );

    const group = await prisma.nhomDichVu.findUnique({
      where: { id },
      select: serviceGroupDetailSelect,
    });

    if (!group) {
      return Send.notFound(res, null, "Không tìm thấy nhóm dịch vụ");
    }

    return Send.success(res, { serviceGroup: mapServiceGroupDetail(group) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const addServiceGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddServiceGroupBody = serviceGroupSchema.addServiceGroupBody.parse(
      req.body,
    );

    const tenNhomDV = payload.tenNhomDV.trim();

    const serviceType = await prisma.loaiDichVu.findUnique({
      where: { id: payload.loaiDichVuId },
      select: { id: true },
    });

    if (!serviceType) {
      return Send.badRequest(res, null, "Loại dịch vụ không tồn tại");
    }

    const conflict = await prisma.nhomDichVu.findFirst({
      where: {
        tenNhomDV,
        ldvId: payload.loaiDichVuId,
      },
      select: { id: true },
    });

    if (conflict) {
      return Send.badRequest(
        res,
        null,
        "Nhóm dịch vụ đã tồn tại trong loại dịch vụ này",
      );
    }

    const group = await prisma.nhomDichVu.create({
      data: {
        tenNhomDV,
        loaiDichVu: { connect: { id: payload.loaiDichVuId } },
      },
      select: serviceGroupSelect,
    });

    return Send.success(
      res,
      { serviceGroup: mapServiceGroup(group) },
      "Tạo nhóm dịch vụ thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Nhóm dịch vụ đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateServiceGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceGroupParam = serviceGroupSchema.serviceGroupParam.parse(
      req.params,
    );
    const payload: UpdateServiceGroupBody =
      serviceGroupSchema.updateServiceGroupBody.parse(req.body);

    const existingGroup = await prisma.nhomDichVu.findUnique({
      where: { id },
      select: { id: true, ldvId: true },
    });

    if (!existingGroup) {
      return Send.notFound(res, null, "Không tìm thấy nhóm dịch vụ");
    }

    const updateData: Prisma.NhomDichVuUpdateInput = {};
    let targetServiceTypeId = existingGroup.ldvId;

    if (payload.loaiDichVuId !== undefined) {
      const serviceType = await prisma.loaiDichVu.findUnique({
        where: { id: payload.loaiDichVuId },
        select: { id: true },
      });

      if (!serviceType) {
        return Send.badRequest(res, null, "Loại dịch vụ không tồn tại");
      }

      targetServiceTypeId = payload.loaiDichVuId;
      updateData.loaiDichVu = { connect: { id: payload.loaiDichVuId } };
    }

    if (payload.tenNhomDV !== undefined) {
      const tenNhomDV = payload.tenNhomDV.trim();

      const nameConflict = await prisma.nhomDichVu.findFirst({
        where: {
          tenNhomDV,
          ldvId: targetServiceTypeId,
          NOT: { id },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return Send.badRequest(
          res,
          null,
          "Nhóm dịch vụ đã tồn tại trong loại dịch vụ này",
        );
      }

      updateData.tenNhomDV = tenNhomDV;
    }

    const group = await prisma.nhomDichVu.update({
      where: { id },
      data: updateData,
      select: serviceGroupSelect,
    });

    return Send.success(
      res,
      { serviceGroup: mapServiceGroup(group) },
      "Cập nhật nhóm dịch vụ thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Nhóm dịch vụ đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy nhóm dịch vụ");
      }
    }

    return next(error);
  }
};

const deleteServiceGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceGroupParam = serviceGroupSchema.serviceGroupParam.parse(
      req.params,
    );

    await prisma.nhomDichVu.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa nhóm dịch vụ thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy nhóm dịch vụ");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa nhóm dịch vụ vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getServiceGroups,
  getServiceGroup,
  addServiceGroup,
  updateServiceGroup,
  deleteServiceGroup,
};
