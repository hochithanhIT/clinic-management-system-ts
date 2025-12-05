import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import invoiceSchema from "../validations/invoice.schema";
import clinicConstants from "../constants/clinic.constants";

const INVOICE_CODE_PREFIX = "HD";
const INVOICE_CODE_PAD = 6;

const INVOICE_STATUS = clinicConstants.invoiceStatus;

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
      phieuChiDinh: {
        select: {
          id: true,
          maPhieuCD: true,
        },
      },
    },
  },
} satisfies Prisma.HoaDonChiTietSelect;

type InvoiceDetailPayload = Prisma.HoaDonChiTietGetPayload<{
  select: typeof invoiceDetailSelect;
}>;

const paymentDetailSelect = {
  id: true,
  soLuong: true,
  tongTien: true,
  trangThaiDongTien: true,
  pcdId: true,
  phieuChiDinh: {
    select: {
      id: true,
      benhAnId: true,
    },
  },
} satisfies Prisma.ChiTietPhieuChiDinhSelect;

type PaymentDetailPayload = Prisma.ChiTietPhieuChiDinhGetPayload<{
  select: typeof paymentDetailSelect;
}>;

type AddInvoiceBody = z.infer<typeof invoiceSchema.addInvoiceBody>;
type UpdateInvoiceBody = z.infer<typeof invoiceSchema.updateInvoiceBody>;
type InvoiceParam = z.infer<typeof invoiceSchema.invoiceParam>;
type AddInvoiceDetailBody = z.infer<typeof invoiceSchema.addInvoiceDetailBody>;
type UpdateInvoiceDetailBody = z.infer<typeof invoiceSchema.updateInvoiceDetailBody>;
type InvoiceDetailParam = z.infer<typeof invoiceSchema.invoiceDetailParam>;
type GetInvoicesQuery = z.infer<typeof invoiceSchema.getInvoicesQuery>;
type SettleInvoiceBody = z.infer<typeof invoiceSchema.settleInvoiceBody>;

const generateNextInvoiceCode = async (): Promise<string> => {
  const latestInvoice = await prisma.hoaDon.findFirst({
    select: { maHD: true },
    orderBy: { id: "desc" },
  });

  let nextSequence = 1;
  if (latestInvoice?.maHD) {
    const match = latestInvoice.maHD.match(/(\d+)$/);
    if (match) {
      nextSequence = Number.parseInt(match[1], 10) + 1;
    }
  }

  while (true) {
    const candidate = `${INVOICE_CODE_PREFIX}${String(nextSequence).padStart(
      INVOICE_CODE_PAD,
      "0",
    )}`;

    const exists = await prisma.hoaDon.findUnique({
      where: { maHD: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    nextSequence += 1;
  }
};

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

const getInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search, medicalRecordId }: GetInvoicesQuery =
      invoiceSchema.getInvoicesQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.HoaDonWhereInput = {};

    if (search) {
      where.maHD = { contains: search, mode: "insensitive" };
    }

    if (medicalRecordId !== undefined) {
      where.benhAnId = medicalRecordId;
    }

    const [invoices, total] = await Promise.all([
      prisma.hoaDon.findMany({
        where,
        select: invoiceSelect,
        skip,
        take: limit,
        orderBy: { ngayLap: "desc" },
      }),
      prisma.hoaDon.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      invoices: invoices.map(mapInvoice),
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

const settleInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: SettleInvoiceBody = invoiceSchema.settleInvoiceBody.parse(req.body);
    const detailIds = Array.from(new Set(payload.serviceDetailIds.map((id) => Number(id))));

    if (detailIds.length === 0) {
      return Send.badRequest(res, null, "Danh sách dịch vụ thanh toán không hợp lệ");
    }

    const [medicalRecord, employee, details] = await Promise.all([
      prisma.benhAn.findUnique({
        where: { id: payload.medicalRecordId },
        select: { id: true },
      }),
      prisma.nhanVien.findUnique({
        where: { id: payload.employeeId },
        select: { id: true },
      }),
      prisma.chiTietPhieuChiDinh.findMany({
        where: { id: { in: detailIds } },
        select: paymentDetailSelect,
      }),
    ]);

    if (!medicalRecord) {
      return Send.badRequest(res, null, "Bệnh án không tồn tại");
    }

    if (!employee) {
      return Send.badRequest(res, null, "Nhân viên không tồn tại");
    }

    if (details.length !== detailIds.length) {
      return Send.badRequest(
        res,
        null,
        "Một số dịch vụ không hợp lệ hoặc đã được xóa",
      );
    }

    const invalidDetail = details.find(
      (detail) => detail.phieuChiDinh.benhAnId !== payload.medicalRecordId,
    );

    if (invalidDetail) {
      return Send.badRequest(
        res,
        null,
        "Chi tiết phiếu chỉ định không thuộc bệnh án này",
      );
    }

    const alreadyPaid = details.find((detail) => detail.trangThaiDongTien);

    if (alreadyPaid) {
      return Send.badRequest(res, null, "Một số dịch vụ đã được thanh toán");
    }

    const totalAmountDecimal = details.reduce(
      (sum, detail) => sum.add(detail.tongTien),
      new Prisma.Decimal(0),
    );

    const totalAmount = Number(totalAmountDecimal);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return Send.badRequest(res, null, "Tổng tiền không hợp lệ");
    }

    if (payload.amountReceived < totalAmount) {
      return Send.badRequest(res, null, "Số tiền nhận được không đủ để thanh toán");
    }

    const invoiceCode = await generateNextInvoiceCode();

    const invoice = await prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.hoaDon.create({
        data: {
          maHD: invoiceCode,
          ngayLap: payload.invoiceDate,
          tongTien: totalAmountDecimal,
          trangThai: 0,
          benhAn: { connect: { id: payload.medicalRecordId } },
          nhanVien: { connect: { id: payload.employeeId } },
        },
        select: invoiceSelect,
      });

      await tx.hoaDonChiTiet.createMany({
        data: details.map((detail) => ({
          hoaDonId: createdInvoice.id,
          ctpcdId: detail.id,
          soLuong: detail.soLuong,
          thanhTien: detail.tongTien,
        })),
      });

      await tx.chiTietPhieuChiDinh.updateMany({
        where: { id: { in: detailIds } },
        data: { trangThaiDongTien: true },
      });

      const serviceOrderIds = Array.from(new Set(details.map((detail) => detail.pcdId)));

      await Promise.all(
        serviceOrderIds.map(async (serviceOrderId) => {
          const remainingUnpaid = await tx.chiTietPhieuChiDinh.count({
            where: {
              pcdId: serviceOrderId,
              trangThaiDongTien: false,
            },
          });

          if (remainingUnpaid === 0) {
            await tx.phieuChiDinh.update({
              where: { id: serviceOrderId },
              data: { trangThai: clinicConstants.serviceOrderStatus.paid },
            });
          }
        }),
      );

      return mapInvoice(createdInvoice);
    });

    const change = Math.max(payload.amountReceived - totalAmount, 0);

    return Send.success(
      res,
      {
        invoice,
        payment: {
          total: totalAmount,
          received: payload.amountReceived,
          change,
        },
      },
      "Thanh toán thành công",
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

const cancelInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: InvoiceParam = invoiceSchema.invoiceParam.parse(req.params);

    const invoice = await prisma.hoaDon.findUnique({
      where: { id },
      select: {
        id: true,
        trangThai: true,
        chiTiet: {
          select: {
            id: true,
            chiTietPCD: {
              select: {
                id: true,
                pcdId: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return Send.notFound(res, null, "Không tìm thấy hóa đơn");
    }

    if (invoice.trangThai === INVOICE_STATUS.cancelled) {
      return Send.badRequest(res, null, "Hóa đơn đã được hủy trước đó");
    }

    const detailRecords = invoice.chiTiet.map((detail) => detail.chiTietPCD);
    const detailIds = detailRecords.map((detail) => detail.id);
    const serviceOrderIds = Array.from(
      new Set(detailRecords.map((detail) => detail.pcdId)),
    );

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      if (detailIds.length > 0) {
        await tx.hoaDonChiTiet.deleteMany({ where: { hoaDonId: id } });

        await tx.chiTietPhieuChiDinh.updateMany({
          where: { id: { in: detailIds } },
          data: { trangThaiDongTien: false },
        });

        if (serviceOrderIds.length > 0) {
          await tx.phieuChiDinh.updateMany({
            where: { id: { in: serviceOrderIds } },
            data: { trangThai: clinicConstants.serviceOrderStatus.pendingPayment },
          });
        }
      }

      const result = await tx.hoaDon.update({
        where: { id },
        data: {
          trangThai: INVOICE_STATUS.cancelled,
          tongTien: new Prisma.Decimal(0),
        },
        select: invoiceSelect,
      });

      return result;
    });

    return Send.success(
      res,
      { invoice: mapInvoice(updatedInvoice) },
      "Hủy hóa đơn thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy hóa đơn");
      }
    }

    return next(error);
  }
};

const getInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: InvoiceParam = invoiceSchema.invoiceParam.parse(req.params);

    const invoice = await prisma.hoaDon.findUnique({
      where: { id },
      select: invoiceSelect,
    });

    if (!invoice) {
      return Send.notFound(res, null, "Không tìm thấy hóa đơn");
    }

    const details = await prisma.hoaDonChiTiet.findMany({
      where: { hoaDonId: id },
      select: invoiceDetailSelect,
      orderBy: { id: "asc" },
    });

    return Send.success(res, {
      invoice: mapInvoice(invoice),
      details: details.map(mapInvoiceDetail),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy hóa đơn");
      }
    }

    return next(error);
  }
};

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
  getInvoices,
  getInvoice,
  settleInvoice,
  addInvoice,
  updateInvoice,
  deleteInvoice,
  cancelInvoice,
  addInvoiceDetail,
  updateInvoiceDetail,
};
