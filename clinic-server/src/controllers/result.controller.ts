import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import resultSchema from "../validations/result.schema";

const resultSelect = {
  id: true,
  tgTiepNhan: true,
  tgThucHien: true,
  tgTraKQ: true,
  ketQua: true,
  ketLuan: true,
  ghiChu: true,
  url: true,
  chiTietPCD: {
    select: {
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
    },
  },
} satisfies Prisma.KetQuaSelect;

const resultDetailSelect = {
  id: true,
  chiSo: true,
  giaTri: true,
  batThuong: true,
  ketQua: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.KetQuaChiTietSelect;

type ResultPayload = Prisma.KetQuaGetPayload<{ select: typeof resultSelect }>;
type ResultDetailPayload = Prisma.KetQuaChiTietGetPayload<{
  select: typeof resultDetailSelect;
}>;

type AddResultBody = z.infer<typeof resultSchema.addResultBody>;
type UpdateResultBody = z.infer<typeof resultSchema.updateResultBody>;
type ResultParam = z.infer<typeof resultSchema.resultParam>;
type GetResultsQuery = z.infer<typeof resultSchema.getResultsQuery>;
type AddResultDetailBody = z.infer<typeof resultSchema.addResultDetailBody>;
type UpdateResultDetailBody = z.infer<typeof resultSchema.updateResultDetailBody>;
type ResultDetailParam = z.infer<typeof resultSchema.resultDetailParam>;

const mapResult = (result: ResultPayload) => ({
  id: result.id,
  tgTiepNhan: result.tgTiepNhan,
  tgThucHien: result.tgThucHien,
  tgTraKQ: result.tgTraKQ,
  ketQua: result.ketQua,
  ketLuan: result.ketLuan,
  ghiChu: result.ghiChu,
  url: result.url,
  chiTietPhieuChiDinh: {
    id: result.chiTietPCD.id,
    soLuong: result.chiTietPCD.soLuong,
    tongTien: result.chiTietPCD.tongTien,
    yeuCauKQ: result.chiTietPCD.yeuCauKQ,
    trangThaiDongTien: result.chiTietPCD.trangThaiDongTien,
    dichVu: result.chiTietPCD.dichVu,
    phieuChiDinh: result.chiTietPCD.phieuChiDinh,
  },
});

const mapResultDetail = (detail: ResultDetailPayload) => ({
  id: detail.id,
  chiSo: detail.chiSo,
  giaTri: detail.giaTri,
  batThuong: detail.batThuong,
  ketQuaId: detail.ketQua.id,
});

const validateChronology = (
  receive: Date,
  perform: Date,
  deliver: Date,
): string | null => {
  if (perform < receive) {
    return "Thời gian thực hiện không được nhỏ hơn thời gian tiếp nhận";
  }

  if (deliver < perform) {
    return "Thời gian trả kết quả không được nhỏ hơn thời gian thực hiện";
  }

  return null;
};

const getResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page,
      limit,
      search,
      serviceOrderId,
      ctpcdId,
      medicalRecordId,
      serviceId,
    }: GetResultsQuery = resultSchema.getResultsQuery.parse(req.query);

    const skip = (page - 1) * limit;

    const andConditions: Prisma.KetQuaWhereInput[] = [];

    if (ctpcdId !== undefined) {
      andConditions.push({ ctpcdId });
    }

    const chiTietFilter: Prisma.ChiTietPhieuChiDinhWhereInput = {};

    if (serviceOrderId !== undefined) {
      chiTietFilter.pcdId = serviceOrderId;
    }

    if (serviceId !== undefined) {
      chiTietFilter.dvId = serviceId;
    }

    if (medicalRecordId !== undefined) {
      chiTietFilter.phieuChiDinh = { benhAnId: medicalRecordId };
    }

    if (Object.keys(chiTietFilter).length > 0) {
      andConditions.push({ chiTietPCD: { is: chiTietFilter } });
    }

    const where: Prisma.KetQuaWhereInput = {};

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (search) {
      where.OR = [
        { ketQua: { contains: search, mode: "insensitive" } },
        { ketLuan: { contains: search, mode: "insensitive" } },
        {
          chiTietPCD: {
            is: {
              dichVu: {
                tenDV: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
        {
          chiTietPCD: {
            is: {
              phieuChiDinh: {
                maPhieuCD: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    const [results, total] = await Promise.all([
      prisma.ketQua.findMany({
        where,
        select: resultSelect,
        skip,
        take: limit,
        orderBy: { tgTraKQ: "desc" },
      }),
      prisma.ketQua.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      results: results.map(mapResult),
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

const getResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }: ResultParam = resultSchema.resultParam.parse(req.params);

    const result = await prisma.ketQua.findUnique({
      where: { id },
      select: resultSelect,
    });

    if (!result) {
      return Send.notFound(res, null, "Không tìm thấy phiếu trả kết quả");
    }

    return Send.success(res, { result: mapResult(result) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const addResult = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: AddResultBody = resultSchema.addResultBody.parse(req.body);

    const [detail, existingResult] = await Promise.all([
      prisma.chiTietPhieuChiDinh.findUnique({
        where: { id: payload.ctpcdId },
        select: { id: true },
      }),
      prisma.ketQua.findUnique({
        where: { ctpcdId: payload.ctpcdId },
        select: { id: true },
      }),
    ]);

    if (!detail) {
      return Send.badRequest(res, null, "Chi tiết phiếu chỉ định không tồn tại");
    }

    if (existingResult) {
      return Send.badRequest(res, null, "Phiếu trả kết quả đã tồn tại cho chi tiết này");
    }

    const chronologyError = validateChronology(
      payload.tgTiepNhan,
      payload.tgThucHien,
      payload.tgTraKQ,
    );

    if (chronologyError) {
      return Send.badRequest(res, null, chronologyError);
    }

    const result = await prisma.ketQua.create({
      data: {
        tgTiepNhan: payload.tgTiepNhan,
        tgThucHien: payload.tgThucHien,
        tgTraKQ: payload.tgTraKQ,
        ketQua: payload.ketQua.trim(),
        ketLuan: payload.ketLuan.trim(),
        ghiChu: payload.ghiChu?.trim() || null,
        url: payload.url?.trim() || null,
        chiTietPCD: { connect: { id: payload.ctpcdId } },
      },
      select: resultSelect,
    });

    return Send.success(
      res,
      { result: mapResult(result) },
      "Tạo phiếu trả kết quả thành công",
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

const updateResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ResultParam = resultSchema.resultParam.parse(req.params);
    const payload: UpdateResultBody = resultSchema.updateResultBody.parse(req.body);

    const existing = await prisma.ketQua.findUnique({
      where: { id },
      select: {
        id: true,
        ctpcdId: true,
        tgTiepNhan: true,
        tgThucHien: true,
        tgTraKQ: true,
      },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy phiếu trả kết quả");
    }

    const updateData: Prisma.KetQuaUpdateInput = {};

    if (payload.ctpcdId !== undefined) {
      const detail = await prisma.chiTietPhieuChiDinh.findUnique({
        where: { id: payload.ctpcdId },
        select: { id: true },
      });

      if (!detail) {
        return Send.badRequest(res, null, "Chi tiết phiếu chỉ định không tồn tại");
      }

      if (payload.ctpcdId !== existing.ctpcdId) {
        const resultConflict = await prisma.ketQua.findUnique({
          where: { ctpcdId: payload.ctpcdId },
          select: { id: true },
        });

        if (resultConflict) {
          return Send.badRequest(
            res,
            null,
            "Phiếu trả kết quả đã tồn tại cho chi tiết này",
          );
        }
      }

      updateData.chiTietPCD = { connect: { id: payload.ctpcdId } };
    }

    const receiveAt = payload.tgTiepNhan ?? existing.tgTiepNhan;
    const performAt = payload.tgThucHien ?? existing.tgThucHien;
    const deliverAt = payload.tgTraKQ ?? existing.tgTraKQ;

    const chronologyError = validateChronology(receiveAt, performAt, deliverAt);
    if (chronologyError) {
      return Send.badRequest(res, null, chronologyError);
    }

    if (payload.tgTiepNhan !== undefined) {
      updateData.tgTiepNhan = payload.tgTiepNhan;
    }

    if (payload.tgThucHien !== undefined) {
      updateData.tgThucHien = payload.tgThucHien;
    }

    if (payload.tgTraKQ !== undefined) {
      updateData.tgTraKQ = payload.tgTraKQ;
    }

    if (payload.ketQua !== undefined) {
      updateData.ketQua = payload.ketQua.trim();
    }

    if (payload.ketLuan !== undefined) {
      updateData.ketLuan = payload.ketLuan.trim();
    }

    if (payload.ghiChu !== undefined) {
      updateData.ghiChu = payload.ghiChu?.trim() || null;
    }

    if (payload.url !== undefined) {
      updateData.url = payload.url?.trim() || null;
    }

    const result = await prisma.ketQua.update({
      where: { id },
      data: updateData,
      select: resultSelect,
    });

    return Send.success(
      res,
      { result: mapResult(result) },
      "Cập nhật phiếu trả kết quả thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phiếu trả kết quả");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const deleteResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ResultParam = resultSchema.resultParam.parse(req.params);

    await prisma.ketQua.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa phiếu trả kết quả thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phiếu trả kết quả");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa phiếu trả kết quả vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

const addResultDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddResultDetailBody =
      resultSchema.addResultDetailBody.parse(req.body);

    const result = await prisma.ketQua.findUnique({
      where: { id: payload.ketQuaId },
      select: { id: true },
    });

    if (!result) {
      return Send.badRequest(res, null, "Phiếu trả kết quả không tồn tại");
    }

    const existingDetail = await prisma.ketQuaChiTiet.findUnique({
      where: { ketQuaId: payload.ketQuaId },
      select: { id: true },
    });

    if (existingDetail) {
      return Send.badRequest(
        res,
        null,
        "Kết quả chi tiết đã tồn tại cho phiếu trả kết quả này",
      );
    }

    const detail = await prisma.ketQuaChiTiet.create({
      data: {
        chiSo: payload.chiSo.trim(),
        giaTri: payload.giaTri.trim(),
        batThuong: payload.batThuong,
        ketQua: { connect: { id: payload.ketQuaId } },
      },
      select: resultDetailSelect,
    });

    return Send.success(
      res,
      { resultDetail: mapResultDetail(detail) },
      "Tạo kết quả chi tiết thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }

      if (error.code === "P2002") {
        return Send.badRequest(
          res,
          null,
          "Kết quả chi tiết đã tồn tại cho phiếu trả kết quả này",
        );
      }
    }

    return next(error);
  }
};

const updateResultDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: ResultDetailParam = resultSchema.resultDetailParam.parse(
      req.params,
    );
    const payload: UpdateResultDetailBody =
      resultSchema.updateResultDetailBody.parse(req.body);

    const existing = await prisma.ketQuaChiTiet.findUnique({
      where: { id },
      select: { id: true, ketQuaId: true },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy kết quả chi tiết");
    }

    const updateData: Prisma.KetQuaChiTietUpdateInput = {};

    if (payload.ketQuaId !== undefined) {
      const result = await prisma.ketQua.findUnique({
        where: { id: payload.ketQuaId },
        select: { id: true },
      });

      if (!result) {
        return Send.badRequest(res, null, "Phiếu trả kết quả không tồn tại");
      }

      if (payload.ketQuaId !== existing.ketQuaId) {
        const conflict = await prisma.ketQuaChiTiet.findUnique({
          where: { ketQuaId: payload.ketQuaId },
          select: { id: true },
        });

        if (conflict) {
          return Send.badRequest(
            res,
            null,
            "Kết quả chi tiết đã tồn tại cho phiếu trả kết quả này",
          );
        }
      }

      updateData.ketQua = { connect: { id: payload.ketQuaId } };
    }

    if (payload.chiSo !== undefined) {
      updateData.chiSo = payload.chiSo.trim();
    }

    if (payload.giaTri !== undefined) {
      updateData.giaTri = payload.giaTri.trim();
    }

    if (payload.batThuong !== undefined) {
      updateData.batThuong = payload.batThuong;
    }

    const detail = await prisma.ketQuaChiTiet.update({
      where: { id },
      data: updateData,
      select: resultDetailSelect,
    });

    return Send.success(
      res,
      { resultDetail: mapResultDetail(detail) },
      "Cập nhật kết quả chi tiết thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy kết quả chi tiết");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

export default {
  getResults,
  getResult,
  addResult,
  updateResult,
  deleteResult,
  addResultDetail,
  updateResultDetail,
};
