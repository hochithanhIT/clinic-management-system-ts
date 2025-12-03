import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import serviceSchema from "../validations/service.schema";
import { z } from "zod";

const serviceSelect = {
  id: true,
  maDV: true,
  tenDV: true,
  donVi: true,
  donGia: true,
  thamChieuMin: true,
  thamChieuMax: true,
  phongThucHienId: true,
  phongThucHien: {
    select: {
      id: true,
      tenPhong: true,
      khoa: {
        select: {
          id: true,
          tenKhoa: true,
        },
      },
    },
  },
  nhomDichVu: {
    select: {
      id: true,
      tenNhomDV: true,
      loaiDichVu: {
        select: {
          id: true,
          tenLoai: true,
        },
      },
    },
  },
} satisfies Prisma.DichVuSelect;

type GetServicesQuery = z.infer<typeof serviceSchema.getServicesQuery>;
type ServiceParam = z.infer<typeof serviceSchema.serviceParam>;
type AddServiceBody = z.infer<typeof serviceSchema.addServiceBody>;
type UpdateServiceBody = z.infer<typeof serviceSchema.updateServiceBody>;

type ServiceResult = Prisma.DichVuGetPayload<{ select: typeof serviceSelect }>;

const mapService = (service: ServiceResult) => ({
  id: service.id,
  maDV: service.maDV,
  tenDV: service.tenDV,
  donVi: service.donVi,
  donGia: service.donGia,
  thamChieuMin: service.thamChieuMin,
  thamChieuMax: service.thamChieuMax,
  phongThucHienId: service.phongThucHienId ?? null,
  phongThucHien: service.phongThucHien
    ? {
        id: service.phongThucHien.id,
        tenPhong: service.phongThucHien.tenPhong,
        khoa: service.phongThucHien.khoa
          ? {
              id: service.phongThucHien.khoa.id,
              tenKhoa: service.phongThucHien.khoa.tenKhoa,
            }
          : null,
      }
    : null,
  nhomDichVu: service.nhomDichVu,
});

const getServices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, search, nhomDichVuId, loaiDichVuId }: GetServicesQuery =
      serviceSchema.getServicesQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.DichVuWhereInput = {};

    if (search) {
      where.OR = [
        { maDV: { contains: search, mode: "insensitive" } },
        { tenDV: { contains: search, mode: "insensitive" } },
      ];
    }

    if (nhomDichVuId !== undefined) {
      where.ndvId = nhomDichVuId;
    }

    if (loaiDichVuId !== undefined) {
      where.nhomDichVu = {
        loaiDichVu: { id: loaiDichVuId },
      };
    }

    const [services, total] = await Promise.all([
      prisma.dichVu.findMany({
        where,
        select: serviceSelect,
        skip,
        take: limit,
        orderBy: { id: "asc" },
      }),
      prisma.dichVu.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      services: services.map(mapService),
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

const addService = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload: AddServiceBody = serviceSchema.addServiceBody.parse(req.body);

    const maDV = payload.maDV.trim();
    const tenDV = payload.tenDV.trim();

    const group = await prisma.nhomDichVu.findUnique({
      where: { id: payload.nhomDichVuId },
      select: { id: true },
    });

    if (!group) {
      return Send.badRequest(res, null, "Nhóm dịch vụ không tồn tại");
    }

    const [codeConflict, nameConflict] = await Promise.all([
      prisma.dichVu.findFirst({ where: { maDV }, select: { id: true } }),
      prisma.dichVu.findFirst({ where: { tenDV }, select: { id: true } }),
    ]);

    if (codeConflict) {
      return Send.badRequest(res, null, "Mã dịch vụ đã tồn tại");
    }

    if (nameConflict) {
      return Send.badRequest(res, null, "Tên dịch vụ đã tồn tại");
    }

    let executionRoomId: number | null = null;

    if (payload.phongThucHienId !== undefined) {
      if (payload.phongThucHienId === null) {
        executionRoomId = null;
      } else {
        const executionRoom = await prisma.phong.findUnique({
          where: { id: payload.phongThucHienId },
          select: { id: true },
        });

        if (!executionRoom) {
          return Send.badRequest(res, null, "Phòng thực hiện không tồn tại");
        }

        executionRoomId = executionRoom.id;
      }
    }

    const service = await prisma.dichVu.create({
      data: {
        maDV,
        tenDV,
        donVi: payload.donVi?.trim() || null,
        donGia: payload.donGia,
        thamChieuMin: payload.thamChieuMin?.trim() || null,
        thamChieuMax: payload.thamChieuMax?.trim() || null,
        nhomDichVu: { connect: { id: payload.nhomDichVuId } },
        ...(executionRoomId !== null
          ? { phongThucHien: { connect: { id: executionRoomId } } }
          : {}),
      },
      select: serviceSelect,
    });

    return Send.success(res, { service: mapService(service) }, "Tạo dịch vụ thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Dịch vụ đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateService = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: ServiceParam = serviceSchema.serviceParam.parse(req.params);
    const payload: UpdateServiceBody = serviceSchema.updateServiceBody.parse(
      req.body,
    );

    const existingService = await prisma.dichVu.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingService) {
      return Send.notFound(res, null, "Không tìm thấy dịch vụ");
    }

    const updateData: Prisma.DichVuUpdateInput = {};

    if (payload.nhomDichVuId !== undefined) {
      const group = await prisma.nhomDichVu.findUnique({
        where: { id: payload.nhomDichVuId },
        select: { id: true },
      });

      if (!group) {
        return Send.badRequest(res, null, "Nhóm dịch vụ không tồn tại");
      }

      updateData.nhomDichVu = { connect: { id: payload.nhomDichVuId } };
    }

    if (payload.maDV !== undefined) {
      const maDV = payload.maDV.trim();

      const codeConflict = await prisma.dichVu.findFirst({
        where: {
          maDV,
          NOT: { id },
        },
        select: { id: true },
      });

      if (codeConflict) {
        return Send.badRequest(res, null, "Mã dịch vụ đã tồn tại");
      }

      updateData.maDV = maDV;
    }

    if (payload.tenDV !== undefined) {
      const tenDV = payload.tenDV.trim();

      const nameConflict = await prisma.dichVu.findFirst({
        where: {
          tenDV,
          NOT: { id },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return Send.badRequest(res, null, "Tên dịch vụ đã tồn tại");
      }

      updateData.tenDV = tenDV;
    }

    if (payload.donVi !== undefined) {
      updateData.donVi = payload.donVi?.trim() || null;
    }

    if (payload.donGia !== undefined) {
      updateData.donGia = payload.donGia;
    }

    if (payload.thamChieuMin !== undefined) {
      updateData.thamChieuMin = payload.thamChieuMin?.trim() || null;
    }

    if (payload.thamChieuMax !== undefined) {
      updateData.thamChieuMax = payload.thamChieuMax?.trim() || null;
    }

    if (payload.phongThucHienId !== undefined) {
      if (payload.phongThucHienId === null) {
        updateData.phongThucHien = { disconnect: true };
      } else {
        const executionRoom = await prisma.phong.findUnique({
          where: { id: payload.phongThucHienId },
          select: { id: true },
        });

        if (!executionRoom) {
          return Send.badRequest(res, null, "Phòng thực hiện không tồn tại");
        }

        updateData.phongThucHien = { connect: { id: payload.phongThucHienId } };
      }
    }

    const service = await prisma.dichVu.update({
      where: { id },
      data: updateData,
      select: serviceSelect,
    });

    return Send.success(res, { service: mapService(service) }, "Cập nhật dịch vụ thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Dịch vụ đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy dịch vụ");
      }
    }

    return next(error);
  }
};

const deleteService = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: ServiceParam = serviceSchema.serviceParam.parse(req.params);

    await prisma.dichVu.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa dịch vụ thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy dịch vụ");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Không thể xóa dịch vụ vì đang được sử dụng");
      }
    }

    return next(error);
  }
};

export default {
  getServices,
  addService,
  updateService,
  deleteService,
};
