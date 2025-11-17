import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import serviceTypeSchema from "../validations/service-type.schema";
import { z } from "zod";

const serviceTypeSelect = {
  id: true,
  tenLoai: true,
} satisfies Prisma.LoaiDichVuSelect;

type ServiceTypeResult = Prisma.LoaiDichVuGetPayload<{
  select: typeof serviceTypeSelect;
}>;

type AddServiceTypeBody = z.infer<
  typeof serviceTypeSchema.addServiceTypeBody
>;
type UpdateServiceTypeBody = z.infer<
  typeof serviceTypeSchema.updateServiceTypeBody
>;
type ServiceTypeParam = z.infer<typeof serviceTypeSchema.serviceTypeParam>;

const mapServiceType = (serviceType: ServiceTypeResult) => ({
  id: serviceType.id,
  tenLoai: serviceType.tenLoai,
});

const addServiceType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddServiceTypeBody =
      serviceTypeSchema.addServiceTypeBody.parse(req.body);

    const tenLoai = payload.tenLoai.trim();

    const existing = await prisma.loaiDichVu.findFirst({
      where: { tenLoai },
      select: { id: true },
    });

    if (existing) {
      return Send.badRequest(res, null, "Tên loại dịch vụ đã tồn tại");
    }

    const serviceType = await prisma.loaiDichVu.create({
      data: { tenLoai },
      select: serviceTypeSelect,
    });

    return Send.success(
      res,
      { serviceType: mapServiceType(serviceType) },
      "Tạo loại dịch vụ thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tên loại dịch vụ đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateServiceType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceTypeParam =
      serviceTypeSchema.serviceTypeParam.parse(req.params);
    const payload: UpdateServiceTypeBody =
      serviceTypeSchema.updateServiceTypeBody.parse(req.body);

    const existing = await prisma.loaiDichVu.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy loại dịch vụ");
    }

    const updateData: Prisma.LoaiDichVuUpdateInput = {};

    if (payload.tenLoai !== undefined) {
      const tenLoai = payload.tenLoai.trim();

      const duplicate = await prisma.loaiDichVu.findFirst({
        where: {
          tenLoai,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return Send.badRequest(res, null, "Tên loại dịch vụ đã tồn tại");
      }

      updateData.tenLoai = tenLoai;
    }

    const serviceType = await prisma.loaiDichVu.update({
      where: { id },
      data: updateData,
      select: serviceTypeSelect,
    });

    return Send.success(
      res,
      { serviceType: mapServiceType(serviceType) },
      "Cập nhật loại dịch vụ thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tên loại dịch vụ đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy loại dịch vụ");
      }
    }

    return next(error);
  }
};

const deleteServiceType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceTypeParam =
      serviceTypeSchema.serviceTypeParam.parse(req.params);

    await prisma.loaiDichVu.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa loại dịch vụ thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy loại dịch vụ");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa loại dịch vụ vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  addServiceType,
  updateServiceType,
  deleteServiceType,
};
