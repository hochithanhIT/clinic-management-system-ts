import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import invoiceSchema from "../validations/invoice.schema";

const invoiceSelect = {
  id: true,
  maHD: true,
  ngayLap: true,
  tongTien: true,
  trangThai: true,
  benhAn: {
    select: {
      id: true,
      maBA: true,
    },
  },
  nhanVien: {
    select: {
      id: true,
      maNV: true,
      hoTen: true,
    },
  },
} satisfies Prisma.HoaDonSelect;

type InvoicePayload = Prisma.HoaDonGetPayload<{ select: typeof invoiceSelect }>;

const invoiceDetailSelect = {
  id: true,
  soLuong: true,
  thanhTien: true,
  hoaDon: {
    select: {
      id: true,
      maHD: true,
    },
  },
  chiTietPCD: {
    select: {
      id: true,
      soLuong: true,
      tongTien: true,
      dichVu: {
        select: {
          id: true,
          maDV: true,
          tenDV: true,
        },
      },
    },
  },
} satisfies Prisma.HoaDonChiTietSelect;

type InvoiceDetailPayload = Prisma.HoaDonChiTietGetPayload<{
  select: typeof invoiceDetailSelect;
}>;

type AddInvoiceBody = z.infer<typeof invoiceSchema.addInvoiceBody>;
type UpdateInvoiceBody = z.infer<typeof invoiceSchema.updateInvoiceBody>;
type InvoiceParam = z.infer<typeof invoiceSchema.invoiceParam>;
type AddInvoiceDetailBody = z.infer<typeof invoiceSchema.addInvoiceDetailBody>;
type UpdateInvoiceDetailBody = z.infer<typeof invoiceSchema.updateInvoiceDetailBody>;
type InvoiceDetailParam = z.infer<typeof invoiceSchema.invoiceDetailParam>;

const mapInvoice = (invoice: InvoicePayload) => ({
  id: invoice.id,
  maHD: invoice.maHD,
  ngayLap: invoice.ngayLap,
  tongTien: invoice.tongTien,
  trangThai: invoice.trangThai,
  benhAn: invoice.benhAn,
  nhanVien: invoice.nhanVien,
});

const mapInvoiceDetail = (detail: InvoiceDetailPayload) => ({
  id: detail.id,
  soLuong: detail.soLuong,
  thanhTien: detail.thanhTien,
  hoaDon: detail.hoaDon,
  chiTietPCD: detail.chiTietPCD,
});

const addInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: AddInvoiceBody = invoiceSchema.addInvoiceBody.parse(req.body);
    const maHD = payload.maHD.trim().toUpperCase();

    const [existingCode, medicalRecord, employee] = await Promise.all([
      prisma.hoaDon.findUnique({
        where: { maHD },
        select: { id: true },
      }),
      prisma.benhAn.findUnique({
        where: { id: payload.benhAnId },
        select: { id: true },
      }),
      prisma.nhanVien.findUnique({
        where: { id: payload.nhanVienId },
        select: { id: true },
      }),
    ]);

    if (existingCode) {
      return Send.badRequest(res, null, "Mã hóa đơn đã tồn tại");
    }

    if (!medicalRecord) {
      return Send.badRequest(res, null, "Bệnh án không tồn tại");
    }

    if (!employee) {
      return Send.badRequest(res, null, "Nhân viên không tồn tại");
    }

    const invoice = await prisma.hoaDon.create({
      data: {
        maHD,
        ngayLap: payload.ngayLap,
        tongTien: payload.tongTien,
        trangThai: payload.trangThai,
        benhAn: { connect: { id: payload.benhAnId } },
        nhanVien: { connect: { id: payload.nhanVienId } },
      },
      select: invoiceSelect,
    });

    return Send.success(
      res,
      { invoice: mapInvoice(invoice) },
      "Tạo hóa đơn thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Hóa đơn đã tồn tại");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: InvoiceParam = invoiceSchema.invoiceParam.parse(req.params);
    const payload: UpdateInvoiceBody = invoiceSchema.updateInvoiceBody.parse(req.body);

    const existing = await prisma.hoaDon.findUnique({
      where: { id },
      select: {
        id: true,
        maHD: true,
      },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy hóa đơn");
    }

    const updateData: Prisma.HoaDonUpdateInput = {};

    if (payload.maHD !== undefined) {
      const maHD = payload.maHD.trim().toUpperCase();

      const conflict = await prisma.hoaDon.findFirst({
        where: {
          maHD,
          NOT: { id },
        },
        select: { id: true },
      });

      if (conflict) {
        return Send.badRequest(res, null, "Mã hóa đơn đã tồn tại");
      }

      updateData.maHD = maHD;
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

    if (payload.nhanVienId !== undefined) {
      const employee = await prisma.nhanVien.findUnique({
        where: { id: payload.nhanVienId },
        select: { id: true },
      });

      if (!employee) {
        return Send.badRequest(res, null, "Nhân viên không tồn tại");
      }

      updateData.nhanVien = { connect: { id: payload.nhanVienId } };
    }

    if (payload.ngayLap !== undefined) {
      updateData.ngayLap = payload.ngayLap;
    }

    if (payload.tongTien !== undefined) {
      updateData.tongTien = payload.tongTien;
    }

    if (payload.trangThai !== undefined) {
      updateData.trangThai = payload.trangThai;
    }

    const invoice = await prisma.hoaDon.update({
      where: { id },
      data: updateData,
      select: invoiceSelect,
    });

    return Send.success(
      res,
      { invoice: mapInvoice(invoice) },
      "Cập nhật hóa đơn thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Hóa đơn đã tồn tại");
      }

      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy hóa đơn");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const deleteInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: InvoiceParam = invoiceSchema.invoiceParam.parse(req.params);

    await prisma.hoaDon.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa hóa đơn thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy hóa đơn");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa hóa đơn vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

const addInvoiceDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddInvoiceDetailBody = invoiceSchema.addInvoiceDetailBody.parse(
      req.body,
    );

    const [invoice, detailRequest] = await Promise.all([
      prisma.hoaDon.findUnique({ where: { id: payload.hoaDonId }, select: { id: true } }),
      prisma.chiTietPhieuChiDinh.findUnique({
        where: { id: payload.ctpcdId },
        select: { id: true },
      }),
    ]);

    if (!invoice) {
      return Send.notFound(res, null, "Không tìm thấy hóa đơn");
    }

    if (!detailRequest) {
      return Send.badRequest(res, null, "Chi tiết phiếu chỉ định không tồn tại");
    }

    const detail = await prisma.hoaDonChiTiet.create({
      data: {
        soLuong: payload.soLuong,
        thanhTien: payload.thanhTien,
        hoaDon: { connect: { id: payload.hoaDonId } },
        chiTietPCD: { connect: { id: payload.ctpcdId } },
      },
      select: invoiceDetailSelect,
    });

    return Send.success(
      res,
      { detail: mapInvoiceDetail(detail) },
      "Tạo chi tiết hóa đơn thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Chi tiết hóa đơn đã tồn tại");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateInvoiceDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: InvoiceDetailParam = invoiceSchema.invoiceDetailParam.parse(
      req.params,
    );
    const payload: UpdateInvoiceDetailBody = invoiceSchema.updateInvoiceDetailBody.parse(
      req.body,
    );

    const existing = await prisma.hoaDonChiTiet.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy chi tiết hóa đơn");
    }

    const updateData: Prisma.HoaDonChiTietUpdateInput = {};

    if (payload.hoaDonId !== undefined) {
      const invoice = await prisma.hoaDon.findUnique({
        where: { id: payload.hoaDonId },
        select: { id: true },
      });

      if (!invoice) {
        return Send.badRequest(res, null, "Hóa đơn không tồn tại");
      }

      updateData.hoaDon = { connect: { id: payload.hoaDonId } };
    }

    if (payload.ctpcdId !== undefined) {
      const detailRequest = await prisma.chiTietPhieuChiDinh.findUnique({
        where: { id: payload.ctpcdId },
        select: { id: true },
      });

      if (!detailRequest) {
        return Send.badRequest(res, null, "Chi tiết phiếu chỉ định không tồn tại");
      }

      updateData.chiTietPCD = { connect: { id: payload.ctpcdId } };
    }

    if (payload.soLuong !== undefined) {
      updateData.soLuong = payload.soLuong;
    }

    if (payload.thanhTien !== undefined) {
      updateData.thanhTien = payload.thanhTien;
    }

    const detail = await prisma.hoaDonChiTiet.update({
      where: { id },
      data: updateData,
      select: invoiceDetailSelect,
    });

    return Send.success(
      res,
      { detail: mapInvoiceDetail(detail) },
      "Cập nhật chi tiết hóa đơn thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy chi tiết hóa đơn");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

export default {
  addInvoice,
  updateInvoice,
  deleteInvoice,
  addInvoiceDetail,
  updateInvoiceDetail,
};
