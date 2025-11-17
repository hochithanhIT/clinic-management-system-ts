import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import serviceOrderSchema from "../validations/service-order.schema";
import { z } from "zod";

const serviceOrderSelect = {
  id: true,
  maPhieuCD: true,
  thoiGianTao: true,
  trangThai: true,
  benhAn: {
    select: {
      id: true,
      maBA: true,
    },
  },
} satisfies Prisma.PhieuChiDinhSelect;

const serviceOrderDetailSelect = {
  id: true,
  soLuong: true,
  tongTien: true,
  yeuCauKQ: true,
  trangThaiDongTien: true,
  dichVu: {
    select: {
      id: true,
      maDV: true,
      tenDV: true,
    },
  },
  phieuChiDinh: {
    select: {
      id: true,
      maPhieuCD: true,
    },
  },
} satisfies Prisma.ChiTietPhieuChiDinhSelect;

type ServiceOrderResult = Prisma.PhieuChiDinhGetPayload<{
  select: typeof serviceOrderSelect;
}>;
type ServiceOrderDetailResult = Prisma.ChiTietPhieuChiDinhGetPayload<{
  select: typeof serviceOrderDetailSelect;
}>;

type AddServiceOrderBody = z.infer<
  typeof serviceOrderSchema.addServiceOrderBody
>;
type UpdateServiceOrderBody = z.infer<
  typeof serviceOrderSchema.updateServiceOrderBody
>;
type ServiceOrderParam = z.infer<
  typeof serviceOrderSchema.serviceOrderParam
>;
type GetServiceOrdersQuery = z.infer<
  typeof serviceOrderSchema.getServiceOrdersQuery
>;
type AddServiceOrderDetailBody = z.infer<
  typeof serviceOrderSchema.addServiceOrderDetailBody
>;
type UpdateServiceOrderDetailBody = z.infer<
  typeof serviceOrderSchema.updateServiceOrderDetailBody
>;
type ServiceOrderDetailParam = z.infer<
  typeof serviceOrderSchema.serviceOrderDetailParam
>;
type ServiceOrderDetailsByOrderParam = z.infer<
  typeof serviceOrderSchema.serviceOrderDetailsByOrderParam
>;

const mapServiceOrder = (order: ServiceOrderResult) => ({
  id: order.id,
  maPhieuCD: order.maPhieuCD,
  thoiGianTao: order.thoiGianTao,
  trangThai: order.trangThai,
  benhAn: order.benhAn,
});

const mapServiceOrderDetail = (detail: ServiceOrderDetailResult) => ({
  id: detail.id,
  soLuong: detail.soLuong,
  tongTien: detail.tongTien,
  yeuCauKQ: detail.yeuCauKQ,
  trangThaiDongTien: detail.trangThaiDongTien,
  dichVu: detail.dichVu,
  phieuChiDinh: detail.phieuChiDinh,
});

const getServiceOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, medicalRecordId }: GetServiceOrdersQuery =
      serviceOrderSchema.getServiceOrdersQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.PhieuChiDinhWhereInput = {};

    if (search) {
      where.maPhieuCD = { contains: search, mode: "insensitive" };
    }

    if (medicalRecordId !== undefined) {
      where.benhAnId = medicalRecordId;
    }

    const [orders, total] = await Promise.all([
      prisma.phieuChiDinh.findMany({
        where,
        select: serviceOrderSelect,
        skip,
        take: limit,
        orderBy: { thoiGianTao: "desc" },
      }),
      prisma.phieuChiDinh.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      serviceOrders: orders.map(mapServiceOrder),
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

const getServiceOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceOrderParam =
      serviceOrderSchema.serviceOrderParam.parse(req.params);

    const order = await prisma.phieuChiDinh.findUnique({
      where: { id },
      select: serviceOrderSelect,
    });

    if (!order) {
      return Send.notFound(res, null, "Không tìm thấy phiếu chỉ định");
    }

    return Send.success(res, { serviceOrder: mapServiceOrder(order) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const addServiceOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddServiceOrderBody =
      serviceOrderSchema.addServiceOrderBody.parse(req.body);

    const maPhieuCD = payload.maPhieuCD.trim().toUpperCase();

    const [existingCode, medicalRecord] = await Promise.all([
      prisma.phieuChiDinh.findUnique({
        where: { maPhieuCD },
        select: { id: true },
      }),
      prisma.benhAn.findUnique({
        where: { id: payload.benhAnId },
        select: { id: true },
      }),
    ]);

    if (existingCode) {
      return Send.badRequest(res, null, "Mã phiếu chỉ định đã tồn tại");
    }

    if (!medicalRecord) {
      return Send.badRequest(res, null, "Bệnh án không tồn tại");
    }

    const order = await prisma.phieuChiDinh.create({
      data: {
        maPhieuCD,
        thoiGianTao: payload.thoiGianTao,
        trangThai: payload.trangThai,
        benhAn: { connect: { id: payload.benhAnId } },
      },
      select: serviceOrderSelect,
    });

    return Send.success(
      res,
      { serviceOrder: mapServiceOrder(order) },
      "Tạo phiếu chỉ định thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Phiếu chỉ định đã tồn tại");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateServiceOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceOrderParam =
      serviceOrderSchema.serviceOrderParam.parse(req.params);
    const payload: UpdateServiceOrderBody =
      serviceOrderSchema.updateServiceOrderBody.parse(req.body);

    const existingOrder = await prisma.phieuChiDinh.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingOrder) {
      return Send.notFound(res, null, "Không tìm thấy phiếu chỉ định");
    }

    const updateData: Prisma.PhieuChiDinhUpdateInput = {};

    if (payload.maPhieuCD !== undefined) {
      const maPhieuCD = payload.maPhieuCD.trim().toUpperCase();

      const conflict = await prisma.phieuChiDinh.findFirst({
        where: {
          maPhieuCD,
          NOT: { id },
        },
        select: { id: true },
      });

      if (conflict) {
        return Send.badRequest(res, null, "Mã phiếu chỉ định đã tồn tại");
      }

      updateData.maPhieuCD = maPhieuCD;
    }

    if (payload.benhAnId !== undefined) {
      const medicalRecord = await prisma.benhAn.findUnique({
        where: { id: payload.benhAnId },
        select: { id: true },
      });

      if (!medicalRecord) {
        return Send.badRequest(res, null, "Bệnh án không tồn tại");
      }

      updateData.benhAn = { connect: { id: payload.benhAnId } };
    }

    if (payload.thoiGianTao !== undefined) {
      updateData.thoiGianTao = payload.thoiGianTao;
    }

    if (payload.trangThai !== undefined) {
      updateData.trangThai = payload.trangThai;
    }

    const order = await prisma.phieuChiDinh.update({
      where: { id },
      data: updateData,
      select: serviceOrderSelect,
    });

    return Send.success(
      res,
      { serviceOrder: mapServiceOrder(order) },
      "Cập nhật phiếu chỉ định thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Phiếu chỉ định đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phiếu chỉ định");
      }
      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const deleteServiceOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceOrderParam =
      serviceOrderSchema.serviceOrderParam.parse(req.params);

    await prisma.phieuChiDinh.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa phiếu chỉ định thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phiếu chỉ định");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa phiếu chỉ định vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

const addServiceOrderDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddServiceOrderDetailBody =
      serviceOrderSchema.addServiceOrderDetailBody.parse(req.body);

    const [order, service] = await Promise.all([
      prisma.phieuChiDinh.findUnique({
        where: { id: payload.phieuChiDinhId },
        select: { id: true },
      }),
      prisma.dichVu.findUnique({
        where: { id: payload.dichVuId },
        select: { id: true },
      }),
    ]);

    if (!order) {
      return Send.badRequest(res, null, "Phiếu chỉ định không tồn tại");
    }

    if (!service) {
      return Send.badRequest(res, null, "Dịch vụ không tồn tại");
    }

    const detail = await prisma.chiTietPhieuChiDinh.create({
      data: {
        soLuong: payload.soLuong,
        tongTien: payload.tongTien,
        yeuCauKQ: payload.yeuCauKQ,
        trangThaiDongTien: payload.trangThaiDongTien,
        phieuChiDinh: { connect: { id: payload.phieuChiDinhId } },
        dichVu: { connect: { id: payload.dichVuId } },
      },
      select: serviceOrderDetailSelect,
    });

    return Send.success(
      res,
      { serviceOrderDetail: mapServiceOrderDetail(detail) },
      "Tạo chi tiết phiếu chỉ định thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateServiceOrderDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ServiceOrderDetailParam =
      serviceOrderSchema.serviceOrderDetailParam.parse(req.params);
    const payload: UpdateServiceOrderDetailBody =
      serviceOrderSchema.updateServiceOrderDetailBody.parse(req.body);

    const existingDetail = await prisma.chiTietPhieuChiDinh.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingDetail) {
      return Send.notFound(res, null, "Không tìm thấy chi tiết phiếu chỉ định");
    }

    const updateData: Prisma.ChiTietPhieuChiDinhUpdateInput = {};

    if (payload.phieuChiDinhId !== undefined) {
      const order = await prisma.phieuChiDinh.findUnique({
        where: { id: payload.phieuChiDinhId },
        select: { id: true },
      });

      if (!order) {
        return Send.badRequest(res, null, "Phiếu chỉ định không tồn tại");
      }

      updateData.phieuChiDinh = { connect: { id: payload.phieuChiDinhId } };
    }

    if (payload.dichVuId !== undefined) {
      const service = await prisma.dichVu.findUnique({
        where: { id: payload.dichVuId },
        select: { id: true },
      });

      if (!service) {
        return Send.badRequest(res, null, "Dịch vụ không tồn tại");
      }

      updateData.dichVu = { connect: { id: payload.dichVuId } };
    }

    if (payload.soLuong !== undefined) {
      updateData.soLuong = payload.soLuong;
    }

    if (payload.tongTien !== undefined) {
      updateData.tongTien = payload.tongTien;
    }

    if (payload.yeuCauKQ !== undefined) {
      updateData.yeuCauKQ = payload.yeuCauKQ;
    }

    if (payload.trangThaiDongTien !== undefined) {
      updateData.trangThaiDongTien = payload.trangThaiDongTien;
    }

    const detail = await prisma.chiTietPhieuChiDinh.update({
      where: { id },
      data: updateData,
      select: serviceOrderDetailSelect,
    });

    return Send.success(
      res,
      { serviceOrderDetail: mapServiceOrderDetail(detail) },
      "Cập nhật chi tiết phiếu chỉ định thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(
          res,
          null,
          "Không tìm thấy chi tiết phiếu chỉ định",
        );
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const getServiceOrderDetailsByOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { serviceOrderId }: ServiceOrderDetailsByOrderParam =
      serviceOrderSchema.serviceOrderDetailsByOrderParam.parse(req.params);

    const order = await prisma.phieuChiDinh.findUnique({
      where: { id: serviceOrderId },
      select: { id: true },
    });

    if (!order) {
      return Send.notFound(res, null, "Không tìm thấy phiếu chỉ định");
    }

    const details = await prisma.chiTietPhieuChiDinh.findMany({
      where: { pcdId: serviceOrderId },
      select: serviceOrderDetailSelect,
      orderBy: { id: "asc" },
    });

    return Send.success(res, {
      serviceOrderDetails: details.map(mapServiceOrderDetail),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

export default {
  getServiceOrders,
  getServiceOrder,
  addServiceOrder,
  updateServiceOrder,
  deleteServiceOrder,
  addServiceOrderDetail,
  updateServiceOrderDetail,
  getServiceOrderDetailsByOrder,
};
