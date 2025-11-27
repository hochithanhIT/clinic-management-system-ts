import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import medicalRecordSchema from "../validations/medical-record.schema";
import { z } from "zod";
import clinicConstants from "../constants/clinic.constants";

const MEDICAL_RECORD_CODE_PREFIX = "BA";
const MEDICAL_RECORD_CODE_PAD = 6;
const SERVICE_ORDER_CODE_PREFIX = "PCD";
const SERVICE_ORDER_CODE_PAD = 6;

const medicalRecordSelect = {
  id: true,
  maBA: true,
  thoiGianVao: true,
  lyDoKhamBenh: true,
  trangThai: true,
  thoiGianKetThuc: true,
  benhNhan: {
    select: {
      id: true,
      maBenhNhan: true,
      hoTen: true,
      ngaySinh: true,
      gioiTinh: true,
      sdt: true,
      cccd: true,
      xaPhuong: {
        select: {
          id: true,
          tenXaPhuong: true,
          tinhTP: {
            select: {
              id: true,
              tenTinhTP: true,
            },
          },
        },
      },
    },
  },
  nvTiepNhan: {
    select: {
      id: true,
      hoTen: true,
      maNV: true,
      khoa: {
        select: {
          id: true,
          tenKhoa: true,
        },
      },
    },
  },
  nvKham: {
    select: {
      id: true,
      hoTen: true,
      maNV: true,
      khoa: {
        select: {
          id: true,
          tenKhoa: true,
          phongs: {
            select: {
              id: true,
              tenPhong: true,
            },
            orderBy: { tenPhong: "asc" },
          },
        },
      },
    },
  },
  phong: {
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
} satisfies Prisma.BenhAnSelect;

type CreateMedicalRecordBody = z.infer<
  typeof medicalRecordSchema.createMedicalRecordBody
>;
type UpdateMedicalRecordBody = z.infer<
  typeof medicalRecordSchema.updateMedicalRecordBody
>;
type MedicalRecordParam = z.infer<
  typeof medicalRecordSchema.medicalRecordParam
>;
type GetMedicalRecordsQuery = z.infer<
  typeof medicalRecordSchema.getMedicalRecordsQuery
>;
type MedicalRecordByPatientParam = z.infer<
  typeof medicalRecordSchema.medicalRecordByPatientParam
>;

type MedicalRecordResult = Prisma.BenhAnGetPayload<{
  select: typeof medicalRecordSelect;
}>;

const mapMedicalRecord = (record: MedicalRecordResult) => ({
  id: record.id,
  maBA: record.maBA,
  thoiGianVao: record.thoiGianVao,
  lyDoKhamBenh: record.lyDoKhamBenh,
  trangThai: record.trangThai,
  thoiGianKetThuc: record.thoiGianKetThuc,
  benhNhan: record.benhNhan
    ? {
        id: record.benhNhan.id,
        maBenhNhan: record.benhNhan.maBenhNhan,
        hoTen: record.benhNhan.hoTen,
        ngaySinh: record.benhNhan.ngaySinh,
        gioiTinh: record.benhNhan.gioiTinh,
        sdt: record.benhNhan.sdt ? record.benhNhan.sdt.trim() : null,
        cccd: record.benhNhan.cccd,
        xaPhuong: record.benhNhan.xaPhuong
          ? {
              id: record.benhNhan.xaPhuong.id,
              tenXaPhuong: record.benhNhan.xaPhuong.tenXaPhuong,
              tinhTP: record.benhNhan.xaPhuong.tinhTP
                ? {
                    id: record.benhNhan.xaPhuong.tinhTP.id,
                    tenTinhTP: record.benhNhan.xaPhuong.tinhTP.tenTinhTP,
                  }
                : null,
            }
          : null,
      }
    : null,
  nvTiepNhan: record.nvTiepNhan
    ? {
        id: record.nvTiepNhan.id,
        hoTen: record.nvTiepNhan.hoTen,
        maNV: record.nvTiepNhan.maNV,
        khoa: record.nvTiepNhan.khoa
          ? {
              id: record.nvTiepNhan.khoa.id,
              tenKhoa: record.nvTiepNhan.khoa.tenKhoa,
            }
          : null,
      }
    : null,
  nvKham: record.nvKham
    ? {
        id: record.nvKham.id,
        hoTen: record.nvKham.hoTen,
        maNV: record.nvKham.maNV,
        khoa: record.nvKham.khoa
          ? {
              id: record.nvKham.khoa.id,
              tenKhoa: record.nvKham.khoa.tenKhoa,
              phongs:
                record.nvKham.khoa.phongs?.map((room) => ({
                  id: room.id,
                  tenPhong: room.tenPhong,
                })) ?? [],
            }
          : null,
      }
    : null,
  phong: record.phong
    ? {
        id: record.phong.id,
        tenPhong: record.phong.tenPhong,
        khoa: record.phong.khoa
          ? {
              id: record.phong.khoa.id,
              tenKhoa: record.phong.khoa.tenKhoa,
            }
          : null,
      }
    : null,
  khoa:
    record.nvKham?.khoa
      ? {
          id: record.nvKham.khoa.id,
          tenKhoa: record.nvKham.khoa.tenKhoa,
        }
      : null,
  phongs:
    record.nvKham?.khoa?.phongs?.map((room) => ({
      id: room.id,
      tenPhong: room.tenPhong,
    })) ?? [],
});

const generateNextMedicalRecordCode = async () => {
  const latestRecord = await prisma.benhAn.findFirst({
    select: { maBA: true },
    orderBy: { id: "desc" },
  });

  let nextSequence = 1;
  if (latestRecord?.maBA) {
    const match = latestRecord.maBA.match(/(\d+)$/);
    if (match) {
      nextSequence = Number.parseInt(match[1], 10) + 1;
    }
  }

  while (true) {
    const candidate = `${MEDICAL_RECORD_CODE_PREFIX}${String(nextSequence).padStart(
      MEDICAL_RECORD_CODE_PAD,
      "0",
    )}`;
    const exists = await prisma.benhAn.findUnique({
      where: { maBA: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    nextSequence += 1;
  }
};

const generateNextServiceOrderCode = async () => {
  const latestOrder = await prisma.phieuChiDinh.findFirst({
    select: { maPhieuCD: true },
    orderBy: { id: "desc" },
  });

  let nextSequence = 1;
  if (latestOrder?.maPhieuCD) {
    const match = latestOrder.maPhieuCD.match(/(\d+)$/);
    if (match) {
      nextSequence = Number.parseInt(match[1], 10) + 1;
    }
  }

  while (true) {
    const candidate = `${SERVICE_ORDER_CODE_PREFIX}${String(nextSequence).padStart(
      SERVICE_ORDER_CODE_PAD,
      "0",
    )}`;
    const exists = await prisma.phieuChiDinh.findUnique({
      where: { maPhieuCD: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    nextSequence += 1;
  }
};

const getMedicalRecords = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      patientId,
      departmentId,
      roomId,
      enteredFrom,
      enteredTo,
    }:
      GetMedicalRecordsQuery = medicalRecordSchema.getMedicalRecordsQuery.parse(
        req.query,
      );

    const skip = (page - 1) * limit;
    const where: Prisma.BenhAnWhereInput = {};

    if (search) {
      where.OR = [
        { maBA: { contains: search, mode: "insensitive" } },
        {
          benhNhan: {
            OR: [
              { hoTen: { contains: search, mode: "insensitive" } },
              { maBenhNhan: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (status !== undefined) {
      where.trangThai = status;
    }

    if (patientId !== undefined) {
      where.benhNhanId = patientId;
    }

    if (departmentId !== undefined) {
      where.nvKham = {
        is: {
          khoaId: departmentId,
        },
      };
    }

    if (roomId !== undefined) {
      where.phongId = roomId;
    }

    if (enteredFrom || enteredTo) {
      where.thoiGianVao = {
        ...(enteredFrom ? { gte: enteredFrom } : {}),
        ...(enteredTo ? { lte: enteredTo } : {}),
      };
    }

    const [records, total] = await Promise.all([
      prisma.benhAn.findMany({
        where,
        select: medicalRecordSelect,
        skip,
        take: limit,
        orderBy: { thoiGianVao: "desc" },
      }),
      prisma.benhAn.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      medicalRecords: records.map(mapMedicalRecord),
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

const getMedicalRecordByPatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { patientId }: MedicalRecordByPatientParam =
      medicalRecordSchema.medicalRecordByPatientParam.parse(req.params);

    const patient = await prisma.benhNhan.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      return Send.notFound(res, null, "Không tìm thấy bệnh nhân");
    }

    const records = await prisma.benhAn.findMany({
      where: { benhNhanId: patientId },
      select: medicalRecordSelect,
      orderBy: { thoiGianVao: "desc" },
    });

    return Send.success(res, {
      medicalRecords: records.map(mapMedicalRecord),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const createMedicalRecord = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: CreateMedicalRecordBody =
      medicalRecordSchema.createMedicalRecordBody.parse(req.body);

    const maBA = payload.maBA
      ? payload.maBA.trim().toUpperCase()
      : await generateNextMedicalRecordCode();

    const doctorId =
      typeof payload.nvKhamId === "number" ? payload.nvKhamId : undefined;

    const [existingCode, patient, staffReceiver, staffDoctor, clinicRoom, examService] = await Promise.all([
      prisma.benhAn.findUnique({
        where: { maBA },
        select: { id: true },
      }),
      prisma.benhNhan.findUnique({
        where: { id: payload.benhNhanId },
        select: { id: true },
      }),
      prisma.nhanVien.findUnique({
        where: { id: payload.nvTiepNhanId },
        select: { id: true },
      }),
      doctorId
        ? prisma.nhanVien.findUnique({
            where: { id: doctorId },
            select: { id: true },
          })
        : Promise.resolve(null),
      payload.phongId && payload.phongId !== null
        ? prisma.phong.findUnique({
            where: { id: payload.phongId },
            select: { id: true },
          })
        : Promise.resolve(null),
      prisma.dichVu.findFirst({
        where: { maDV: clinicConstants.examServiceCode },
        select: { id: true, donGia: true },
      }),
    ]);

    if (existingCode) {
      return Send.badRequest(res, null, "Mã bệnh án đã tồn tại");
    }

    if (!patient) {
      return Send.badRequest(res, null, "Bệnh nhân không tồn tại");
    }

    if (!staffReceiver) {
      return Send.badRequest(res, null, "Nhân viên tiếp nhận không tồn tại");
    }

    if (doctorId && !staffDoctor) {
      return Send.badRequest(res, null, "Nhân viên khám bệnh không tồn tại");
    }

    if (payload.phongId && !clinicRoom) {
      return Send.badRequest(res, null, "Phòng khám không tồn tại");
    }

    if (!examService) {
      return Send.error(
        res,
        null,
        "Không tìm thấy dịch vụ khám bệnh, vui lòng liên hệ quản trị viên",
      );
    }

    if (payload.thoiGianKetThuc instanceof Date) {
      if (payload.thoiGianKetThuc < payload.thoiGianVao) {
        return Send.badRequest(
          res,
          null,
          "Thời gian kết thúc không được nhỏ hơn thời gian vào",
        );
      }
    }

    const serviceOrderCode = await generateNextServiceOrderCode();

    const createdRecordId = await prisma.$transaction(async (tx) => {
      const record = await tx.benhAn.create({
        data: {
          maBA,
          thoiGianVao: payload.thoiGianVao,
          lyDoKhamBenh: payload.lyDoKhamBenh.trim(),
          trangThai: clinicConstants.medicalRecordStatus.waitingForExam,
          thoiGianKetThuc: null,
          benhNhan: { connect: { id: payload.benhNhanId } },
          nvTiepNhan: { connect: { id: payload.nvTiepNhanId } },
          ...(doctorId ? { nvKham: { connect: { id: doctorId } } } : {}),
          ...(payload.phongId && payload.phongId !== null
            ? { phong: { connect: { id: payload.phongId } } }
            : {}),
        },
        select: { id: true },
      });

      const serviceOrder = await tx.phieuChiDinh.create({
        data: {
          maPhieuCD: serviceOrderCode,
          thoiGianTao: payload.thoiGianVao,
          trangThai: clinicConstants.serviceOrderStatus.pendingPayment,
          benhAn: { connect: { id: record.id } },
        },
        select: { id: true },
      });

      await tx.chiTietPhieuChiDinh.create({
        data: {
          soLuong: 1,
          tongTien: examService.donGia,
          yeuCauKQ: false,
          trangThaiDongTien: false,
          phieuChiDinh: { connect: { id: serviceOrder.id } },
          dichVu: { connect: { id: examService.id } },
        },
      });

      return record.id;
    });

    const medicalRecord = await prisma.benhAn.findUnique({
      where: { id: createdRecordId },
      select: medicalRecordSelect,
    });

    if (!medicalRecord) {
      return Send.error(res, null, "Không thể lấy thông tin bệnh án vừa tạo");
    }

    return Send.success(
      res,
      { medicalRecord: mapMedicalRecord(medicalRecord) },
      "Tạo bệnh án thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Bệnh án đã tồn tại");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateMedicalRecord = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: MedicalRecordParam =
      medicalRecordSchema.medicalRecordParam.parse(req.params);
    const payload: UpdateMedicalRecordBody =
      medicalRecordSchema.updateMedicalRecordBody.parse(req.body);

    const existingRecord = await prisma.benhAn.findUnique({
      where: { id },
      select: {
        id: true,
        thoiGianVao: true,
      },
    });

    if (!existingRecord) {
      return Send.notFound(res, null, "Không tìm thấy bệnh án");
    }

    const updateData: Prisma.BenhAnUpdateInput = {};

    if (payload.maBA !== undefined) {
      const maBA = payload.maBA.trim().toUpperCase();
      const conflict = await prisma.benhAn.findFirst({
        where: {
          maBA,
          NOT: { id },
        },
        select: { id: true },
      });

      if (conflict) {
        return Send.badRequest(res, null, "Mã bệnh án đã tồn tại");
      }

      updateData.maBA = maBA;
    }

    if (payload.benhNhanId !== undefined) {
      const patient = await prisma.benhNhan.findUnique({
        where: { id: payload.benhNhanId },
        select: { id: true },
      });

      if (!patient) {
        return Send.badRequest(res, null, "Bệnh nhân không tồn tại");
      }

      updateData.benhNhan = { connect: { id: payload.benhNhanId } };
    }

    if (payload.nvTiepNhanId !== undefined) {
      const staffReceiver = await prisma.nhanVien.findUnique({
        where: { id: payload.nvTiepNhanId },
        select: { id: true },
      });

      if (!staffReceiver) {
        return Send.badRequest(res, null, "Nhân viên tiếp nhận không tồn tại");
      }

      updateData.nvTiepNhan = { connect: { id: payload.nvTiepNhanId } };
    }

    if (payload.nvKhamId !== undefined) {
      if (payload.nvKhamId === null) {
        updateData.nvKham = { disconnect: true };
      } else {
        const staffDoctor = await prisma.nhanVien.findUnique({
          where: { id: payload.nvKhamId },
          select: { id: true },
        });

        if (!staffDoctor) {
          return Send.badRequest(res, null, "Nhân viên khám bệnh không tồn tại");
        }

        updateData.nvKham = { connect: { id: payload.nvKhamId } };
      }
    }

    if (payload.phongId !== undefined) {
      if (payload.phongId === null) {
        updateData.phong = { disconnect: true };
      } else {
        const clinicRoom = await prisma.phong.findUnique({
          where: { id: payload.phongId },
          select: { id: true },
        });

        if (!clinicRoom) {
          return Send.badRequest(res, null, "Phòng khám không tồn tại");
        }

        updateData.phong = { connect: { id: payload.phongId } };
      }
    }

    if (payload.thoiGianVao !== undefined) {
      updateData.thoiGianVao = payload.thoiGianVao;
    }

    if (payload.lyDoKhamBenh !== undefined) {
      updateData.lyDoKhamBenh = payload.lyDoKhamBenh.trim();
    }

    if (payload.trangThai !== undefined) {
      updateData.trangThai = payload.trangThai;
    }

    if (payload.thoiGianKetThuc !== undefined) {
      if (payload.thoiGianKetThuc instanceof Date) {
        const startTime = payload.thoiGianVao ?? existingRecord.thoiGianVao;
        if (payload.thoiGianKetThuc < startTime) {
          return Send.badRequest(
            res,
            null,
            "Thời gian kết thúc không được nhỏ hơn thời gian vào",
          );
        }

        updateData.thoiGianKetThuc = payload.thoiGianKetThuc;
      } else {
        updateData.thoiGianKetThuc = null;
      }
    }

    const medicalRecord = await prisma.benhAn.update({
      where: { id },
      data: updateData,
      select: medicalRecordSelect,
    });

    return Send.success(
      res,
      { medicalRecord: mapMedicalRecord(medicalRecord) },
      "Cập nhật bệnh án thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Bệnh án đã tồn tại");
      }

      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy bệnh án");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const deleteMedicalRecord = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: MedicalRecordParam =
      medicalRecordSchema.medicalRecordParam.parse(req.params);

    await prisma.benhAn.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa bệnh án thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy bệnh án");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa bệnh án vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getMedicalRecords,
  getMedicalRecordByPatient,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
};
