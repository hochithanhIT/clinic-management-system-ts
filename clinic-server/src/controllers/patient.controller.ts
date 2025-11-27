import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import patientSchema from "../validations/patient.schema";
import { z } from "zod";
import clinicConstants from "../constants/clinic.constants";

const PATIENT_CODE_PREFIX = "BN";
const PATIENT_CODE_PAD = 6;

const patientSelect = {
  id: true,
  maBenhNhan: true,
  hoTen: true,
  ngaySinh: true,
  gioiTinh: true,
  sdt: true,
  cccd: true,
  hoTenNguoiNha: true,
  sdtNguoiNha: true,
  quanHe: true,
  ngheNghiep: {
    select: { id: true, tenNgheNghiep: true },
  },
  xaPhuong: {
    select: {
      id: true,
      tenXaPhuong: true,
      tinhTP: { select: { id: true, tenTinhTP: true } },
    },
  },
} satisfies Prisma.BenhNhanSelect;

const generateNextPatientCode = async () => {
  const latestPatient = await prisma.benhNhan.findFirst({
    select: { maBenhNhan: true },
    orderBy: { id: "desc" },
  });

  let nextSequence = 1;
  if (latestPatient?.maBenhNhan) {
    const match = latestPatient.maBenhNhan.match(/(\d+)$/);
    if (match) {
      nextSequence = Number.parseInt(match[1], 10) + 1;
    }
  }

  // Guard against rare collisions by checking until an unused code is found
  while (true) {
    const candidate = `${PATIENT_CODE_PREFIX}${String(nextSequence).padStart(
      PATIENT_CODE_PAD,
      "0"
    )}`;
    const exists = await prisma.benhNhan.findUnique({
      where: { maBenhNhan: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    nextSequence += 1;
  }
};

type AddNewPatientBody = z.infer<typeof patientSchema.addNewPatient>;
type GetPatientsQuery = z.infer<typeof patientSchema.getPatientsQuery>;
type GetPatientParam = z.infer<typeof patientSchema.getPatientParam>;
type UpdatePatientBody = z.infer<typeof patientSchema.updatePatientBody>;

const addNewPatient = async (
  req: Request<unknown, unknown, AddNewPatientBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = patientSchema.addNewPatient.parse(req.body);

    const [ngheNghiep, xaPhuong] = await Promise.all([
      prisma.ngheNghiep.findUnique({
        where: { id: payload.ngheNghiepId },
        select: { id: true, tenNgheNghiep: true },
      }),
      prisma.xaPhuong.findUnique({
        where: { id: payload.xaPhuongId },
        select: {
          id: true,
          tenXaPhuong: true,
          tinhTP: { select: { id: true, tenTinhTP: true } },
        },
      }),
    ]);

    if (!ngheNghiep) {
      return Send.badRequest(res, null, "Nghề nghiệp không tồn tại");
    }

    if (!xaPhuong) {
      return Send.badRequest(res, null, "Xã/Phường không tồn tại");
    }

    const maBenhNhan = (payload.maBenhNhan?.toUpperCase() || (await generateNextPatientCode()));

    const [existingCode, existingPhone, existingCccd] = await Promise.all([
      prisma.benhNhan.findUnique({
        where: { maBenhNhan },
        select: { id: true },
      }),
      payload.sdt
        ? prisma.benhNhan.findUnique({
            where: { sdt: payload.sdt },
            select: { id: true },
          })
        : Promise.resolve(null),
      payload.cccd
        ? prisma.benhNhan.findUnique({
            where: { cccd: payload.cccd },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (existingCode) {
      return Send.badRequest(res, null, "Mã bệnh nhân đã tồn tại");
    }

    if (existingPhone) {
      return Send.badRequest(res, null, "Số điện thoại đã được sử dụng");
    }

    if (existingCccd) {
      return Send.badRequest(res, null, "CCCD đã được sử dụng");
    }

    const newPatient = await prisma.benhNhan.create({
      data: {
        maBenhNhan,
        hoTen: payload.hoTen,
        ngaySinh: payload.ngaySinh,
        gioiTinh: payload.gioiTinh,
        sdt: payload.sdt ?? null,
        cccd: payload.cccd ?? null,
        hoTenNguoiNha: payload.hoTenNguoiNha ?? null,
        sdtNguoiNha: payload.sdtNguoiNha ?? null,
        quanHe: payload.quanHe ?? null,
        ngheNghiepId: payload.ngheNghiepId,
        xaPhuongId: payload.xaPhuongId,
      },
      select: patientSelect,
    });

    return Send.success(res, { patient: newPatient }, "Thêm bệnh nhân thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Thông tin bệnh nhân bị trùng lặp");
      }
    }

    return next(error);
  }
};

const getPatients = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, search }: GetPatientsQuery = patientSchema.getPatientsQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.BenhNhanWhereInput = {};

    if (search) {
      where.OR = [
        { maBenhNhan: { contains: search, mode: "insensitive" } },
        { hoTen: { contains: search, mode: "insensitive" } },
        { sdt: { contains: search, mode: "insensitive" } },
        { cccd: { contains: search, mode: "insensitive" } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.benhNhan.findMany({
        where,
        select: patientSelect,
        skip,
        take: limit,
        orderBy: { id: "desc" },
      }),
      prisma.benhNhan.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      patients,
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

const getPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: GetPatientParam = patientSchema.getPatientParam.parse(req.params);

    const patient = await prisma.benhNhan.findUnique({
      where: { id },
      select: patientSelect,
    });

    if (!patient) {
      return Send.notFound(res, null, "Không tìm thấy bệnh nhân");
    }

    return Send.success(res, { patient });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const updatePatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: GetPatientParam = patientSchema.getPatientParam.parse(req.params);
    const payload: UpdatePatientBody = patientSchema.updatePatientBody.parse(req.body);

    const existingPatient = await prisma.benhNhan.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingPatient) {
      return Send.notFound(res, null, "Không tìm thấy bệnh nhân");
    }

    const maBenhNhan =
      payload.maBenhNhan !== undefined
        ? payload.maBenhNhan.toUpperCase()
        : undefined;

    const [codeConflict, phoneConflict, cccdConflict] = await Promise.all([
      maBenhNhan
        ? prisma.benhNhan.findFirst({
            where: {
              maBenhNhan,
              NOT: { id },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      payload.sdt
        ? prisma.benhNhan.findFirst({
            where: {
              sdt: payload.sdt,
              NOT: { id },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      payload.cccd
        ? prisma.benhNhan.findFirst({
            where: {
              cccd: payload.cccd,
              NOT: { id },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (codeConflict) {
      return Send.badRequest(res, null, "Mã bệnh nhân đã tồn tại");
    }

    if (phoneConflict) {
      return Send.badRequest(res, null, "Số điện thoại đã được sử dụng");
    }

    if (cccdConflict) {
      return Send.badRequest(res, null, "CCCD đã được sử dụng");
    }

    const [ngheNghiep, xaPhuong] = await Promise.all([
      payload.ngheNghiepId
        ? prisma.ngheNghiep.findUnique({
            where: { id: payload.ngheNghiepId },
            select: { id: true },
          })
        : Promise.resolve(null),
      payload.xaPhuongId
        ? prisma.xaPhuong.findUnique({
            where: { id: payload.xaPhuongId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (payload.ngheNghiepId && !ngheNghiep) {
      return Send.badRequest(res, null, "Nghề nghiệp không tồn tại");
    }

    if (payload.xaPhuongId && !xaPhuong) {
      return Send.badRequest(res, null, "Xã/Phường không tồn tại");
    }

    const updateData: Prisma.BenhNhanUpdateInput = {};

    if (maBenhNhan !== undefined) updateData.maBenhNhan = maBenhNhan;
    if (payload.hoTen !== undefined) updateData.hoTen = payload.hoTen;
    if (payload.ngaySinh !== undefined) updateData.ngaySinh = payload.ngaySinh;
    if (payload.gioiTinh !== undefined) updateData.gioiTinh = payload.gioiTinh;
    if (payload.sdt !== undefined) updateData.sdt = payload.sdt;
    if (payload.cccd !== undefined) updateData.cccd = payload.cccd;
    if (payload.hoTenNguoiNha !== undefined) updateData.hoTenNguoiNha = payload.hoTenNguoiNha;
    if (payload.sdtNguoiNha !== undefined) updateData.sdtNguoiNha = payload.sdtNguoiNha;
    if (payload.quanHe !== undefined) updateData.quanHe = payload.quanHe;
    if (payload.ngheNghiepId !== undefined) {
      updateData.ngheNghiep = { connect: { id: payload.ngheNghiepId } };
    }
    if (payload.xaPhuongId !== undefined) {
      updateData.xaPhuong = { connect: { id: payload.xaPhuongId } };
    }

    const updatedPatient = await prisma.benhNhan.update({
      where: { id },
      data: updateData,
      select: patientSelect,
    });

    return Send.success(res, { patient: updatedPatient }, "Cập nhật bệnh nhân thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Thông tin bệnh nhân bị trùng lặp");
      }
    }

    return next(error);
  }
};

const deletePatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: GetPatientParam = patientSchema.getPatientParam.parse(req.params);

    const patient = await prisma.benhNhan.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!patient) {
      return Send.notFound(res, null, "Không tìm thấy bệnh nhân");
    }

    const [examinationCount, blockingServiceOrder] = await Promise.all([
      prisma.phieuKhamBenh.count({
        where: { benhAn: { benhNhanId: id } },
      }),
      prisma.phieuChiDinh.findFirst({
        where: {
          benhAn: { benhNhanId: id },
          OR: [
            { chiTiet: { none: {} } },
            {
              chiTiet: {
                some: {
                  OR: [
                    { trangThaiDongTien: true },
                    {
                      dichVu: {
                        maDV: { not: clinicConstants.examServiceCode },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (examinationCount > 0 || blockingServiceOrder) {
      return Send.badRequest(
        res,
        null,
        "Không thể xóa bệnh nhân vì đã có phiếu khám bệnh hoặc phiếu chỉ định dịch vụ",
      );
    }


    await prisma.$transaction(async (tx) => {
      const medicalRecords = await tx.benhAn.findMany({
        where: { benhNhanId: id },
        select: { id: true },
      });

      if (medicalRecords.length > 0) {
        const recordIds = medicalRecords.map((record) => record.id);

        await tx.ketQuaChiTiet.deleteMany({
          where: {
            ketQua: {
              chiTietPCD: {
                phieuChiDinh: {
                  benhAnId: { in: recordIds },
                },
              },
            },
          },
        });

        await tx.ketQua.deleteMany({
          where: {
            chiTietPCD: {
              phieuChiDinh: {
                benhAnId: { in: recordIds },
              },
            },
          },
        });

        await tx.hoaDonChiTiet.deleteMany({
          where: {
            OR: [
              { hoaDon: { benhAnId: { in: recordIds } } },
              {
                chiTietPCD: {
                  phieuChiDinh: { benhAnId: { in: recordIds } },
                },
              },
            ],
          },
        });

        await tx.hoaDon.deleteMany({
          where: { benhAnId: { in: recordIds } },
        });

        await tx.chiTietPhieuChiDinh.deleteMany({
          where: {
            phieuChiDinh: { benhAnId: { in: recordIds } },
          },
        });

        await tx.phieuChiDinh.deleteMany({
          where: { benhAnId: { in: recordIds } },
        });

        await tx.benhAn.deleteMany({
          where: { id: { in: recordIds } },
        });
      }

      await tx.benhNhan.delete({
        where: { id },
      });
    });

    return Send.success(res, null, "Xóa bệnh nhân thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy bệnh nhân");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Không thể xóa bệnh nhân vì đang được sử dụng");
      }
    }

    return next(error);
  }
};

export default {
  addNewPatient,
  getPatients,
  getPatient,
  updatePatient,
  deletePatient,
};
