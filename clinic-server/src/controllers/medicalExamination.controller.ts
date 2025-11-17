import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import medicalExaminationSchema from "../validations/medical-examination.schema";
import { z } from "zod";

const MEDICAL_EXAMINATION_CODE_PREFIX = "PKB";
const MEDICAL_EXAMINATION_CODE_PAD = 6;

const medicalExaminationSelect = {
  id: true,
  maPhieu: true,
  thoiGianKham: true,
  quaTrinhBenhLy: true,
  tienSuBanThan: true,
  tienSuGiaDinh: true,
  khamToanThan: true,
  khamBoPhan: true,
  mach: true,
  nhietDo: true,
  nhipTho: true,
  canNang: true,
  chieuCao: true,
  huyetApTThu: true,
  huyetApTTr: true,
  bmi: true,
  phuongPhapDieuTri: true,
  xuTri: true,
  chanDoans: {
    select: {
      benhId: true,
      benhChinh: true,
      benh: {
        select: {
          id: true,
          maICD10: true,
          tenBenh: true,
        },
      },
    },
    orderBy: [
      { benhChinh: "desc" },
      { benhId: "asc" },
    ],
  },
  benhAn: {
    select: {
      id: true,
      maBA: true,
      benhNhan: {
        select: {
          id: true,
          maBenhNhan: true,
          hoTen: true,
        },
      },
    },
  },
} satisfies Prisma.PhieuKhamBenhSelect;

type CreateMedicalExaminationBody = z.infer<
  typeof medicalExaminationSchema.createMedicalExaminationBody
>;
type UpdateMedicalExaminationBody = z.infer<
  typeof medicalExaminationSchema.updateMedicalExaminationBody
>;
type MedicalExaminationParam = z.infer<
  typeof medicalExaminationSchema.medicalExaminationParam
>;

type MedicalExaminationResult = Prisma.PhieuKhamBenhGetPayload<{
  select: typeof medicalExaminationSelect;
}>;

const mapMedicalExamination = (exam: MedicalExaminationResult) => ({
  id: exam.id,
  maPhieu: exam.maPhieu,
  thoiGianKham: exam.thoiGianKham,
  quaTrinhBenhLy: exam.quaTrinhBenhLy,
  tienSuBanThan: exam.tienSuBanThan,
  tienSuGiaDinh: exam.tienSuGiaDinh,
  khamToanThan: exam.khamToanThan,
  khamBoPhan: exam.khamBoPhan,
  mach: exam.mach,
  nhietDo: exam.nhietDo,
  nhipTho: exam.nhipTho,
  canNang: exam.canNang,
  chieuCao: exam.chieuCao,
  huyetApTThu: exam.huyetApTThu,
  huyetApTTr: exam.huyetApTTr,
  bmi: exam.bmi,
  phuongPhapDieuTri: exam.phuongPhapDieuTri,
  xuTri: exam.xuTri,
  chanDoans:
    exam.chanDoans?.map((diagnosis) => ({
      benhId: diagnosis.benhId,
      benhChinh: diagnosis.benhChinh,
      benh: diagnosis.benh
        ? {
            id: diagnosis.benh.id,
            maICD10: diagnosis.benh.maICD10,
            tenBenh: diagnosis.benh.tenBenh,
          }
        : null,
    })) ?? [],
  benhAn: exam.benhAn
    ? {
        id: exam.benhAn.id,
        maBA: exam.benhAn.maBA,
        benhNhan: exam.benhAn.benhNhan,
      }
    : null,
});

const generateNextMedicalExaminationCode = async () => {
  const latestExam = await prisma.phieuKhamBenh.findFirst({
    select: { maPhieu: true },
    orderBy: { id: "desc" },
  });

  let nextSequence = 1;
  if (latestExam?.maPhieu) {
    const match = latestExam.maPhieu.match(/(\d+)$/);
    if (match) {
      nextSequence = Number.parseInt(match[1], 10) + 1;
    }
  }

  while (true) {
    const candidate = `${MEDICAL_EXAMINATION_CODE_PREFIX}${String(nextSequence).padStart(
      MEDICAL_EXAMINATION_CODE_PAD,
      "0",
    )}`;

    const exists = await prisma.phieuKhamBenh.findUnique({
      where: { maPhieu: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    nextSequence += 1;
  }
};

const getMedicalExamination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: MedicalExaminationParam =
      medicalExaminationSchema.medicalExaminationParam.parse(req.params);

    const examination = await prisma.phieuKhamBenh.findUnique({
      where: { id },
      select: medicalExaminationSelect,
    });

    if (!examination) {
      return Send.notFound(res, null, "Không tìm thấy phiếu khám bệnh");
    }

    return Send.success(res, {
      medicalExamination: mapMedicalExamination(examination),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const createMedicalExamination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: CreateMedicalExaminationBody =
      medicalExaminationSchema.createMedicalExaminationBody.parse(req.body);

    const maPhieu = payload.maPhieu
      ? payload.maPhieu.trim().toUpperCase()
      : await generateNextMedicalExaminationCode();

    const [existingCode, medicalRecord, existingExam] = await Promise.all([
      prisma.phieuKhamBenh.findUnique({
        where: { maPhieu },
        select: { id: true },
      }),
      prisma.benhAn.findUnique({
        where: { id: payload.benhAnId },
        select: { id: true, maBA: true },
      }),
      prisma.phieuKhamBenh.findUnique({
        where: { benhAnId: payload.benhAnId },
        select: { id: true },
      }),
    ]);

    if (existingCode) {
      return Send.badRequest(res, null, "Mã phiếu khám đã tồn tại");
    }

    if (!medicalRecord) {
      return Send.badRequest(res, null, "Bệnh án không tồn tại");
    }

    if (existingExam) {
      return Send.badRequest(
        res,
        null,
        "Bệnh án đã có phiếu khám bệnh, vui lòng cập nhật phiếu hiện có",
      );
    }

    const createData: Prisma.PhieuKhamBenhCreateInput = {
      maPhieu,
      thoiGianKham: payload.thoiGianKham,
      benhAn: { connect: { id: payload.benhAnId } },
    };

    if (payload.quaTrinhBenhLy !== undefined) {
      createData.quaTrinhBenhLy = payload.quaTrinhBenhLy;
    }

    if (payload.tienSuBanThan !== undefined) {
      createData.tienSuBanThan = payload.tienSuBanThan;
    }

    if (payload.tienSuGiaDinh !== undefined) {
      createData.tienSuGiaDinh = payload.tienSuGiaDinh;
    }

    if (payload.khamToanThan !== undefined) {
      createData.khamToanThan = payload.khamToanThan;
    }

    if (payload.khamBoPhan !== undefined) {
      createData.khamBoPhan = payload.khamBoPhan;
    }

    if (payload.mach !== undefined) {
      createData.mach = payload.mach;
    }

    if (payload.nhietDo !== undefined) {
      createData.nhietDo = payload.nhietDo;
    }

    if (payload.nhipTho !== undefined) {
      createData.nhipTho = payload.nhipTho;
    }

    if (payload.canNang !== undefined) {
      createData.canNang = payload.canNang;
    }

    if (payload.chieuCao !== undefined) {
      createData.chieuCao = payload.chieuCao;
    }

    if (payload.huyetApTThu !== undefined) {
      createData.huyetApTThu = payload.huyetApTThu;
    }

    if (payload.huyetApTTr !== undefined) {
      createData.huyetApTTr = payload.huyetApTTr;
    }

    if (payload.bmi !== undefined) {
      createData.bmi = payload.bmi;
    }

    if (payload.phuongPhapDieuTri !== undefined) {
      createData.phuongPhapDieuTri = payload.phuongPhapDieuTri;
    }

    if (payload.xuTri !== undefined) {
      createData.xuTri = payload.xuTri;
    }

    const medicalExamination = await prisma.phieuKhamBenh.create({
      data: createData,
      select: medicalExaminationSelect,
    });

    return Send.success(
      res,
      { medicalExamination: mapMedicalExamination(medicalExamination) },
      "Tạo phiếu khám bệnh thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Phiếu khám bệnh đã tồn tại");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateMedicalExamination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: MedicalExaminationParam =
      medicalExaminationSchema.medicalExaminationParam.parse(req.params);
    const payload: UpdateMedicalExaminationBody =
      medicalExaminationSchema.updateMedicalExaminationBody.parse(req.body);

    const existingExam = await prisma.phieuKhamBenh.findUnique({
      where: { id },
      select: { id: true, benhAnId: true },
    });

    if (!existingExam) {
      return Send.notFound(res, null, "Không tìm thấy phiếu khám bệnh");
    }

    const updateData: Prisma.PhieuKhamBenhUpdateInput = {};

    if (payload.maPhieu !== undefined) {
      const maPhieu = payload.maPhieu.trim().toUpperCase();

      const codeConflict = await prisma.phieuKhamBenh.findFirst({
        where: {
          maPhieu,
          NOT: { id },
        },
        select: { id: true },
      });

      if (codeConflict) {
        return Send.badRequest(res, null, "Mã phiếu khám đã tồn tại");
      }

      updateData.maPhieu = maPhieu;
    }

    if (payload.benhAnId !== undefined) {
      const medicalRecord = await prisma.benhAn.findUnique({
        where: { id: payload.benhAnId },
        select: { id: true },
      });

      if (!medicalRecord) {
        return Send.badRequest(res, null, "Bệnh án không tồn tại");
      }

      const examConflict = await prisma.phieuKhamBenh.findFirst({
        where: {
          benhAnId: payload.benhAnId,
          NOT: { id },
        },
        select: { id: true },
      });

      if (examConflict) {
        return Send.badRequest(
          res,
          null,
          "Bệnh án đã có phiếu khám bệnh, vui lòng chọn bệnh án khác",
        );
      }

      updateData.benhAn = { connect: { id: payload.benhAnId } };
    }

    if (payload.thoiGianKham !== undefined) {
      updateData.thoiGianKham = payload.thoiGianKham;
    }

    if (payload.quaTrinhBenhLy !== undefined) {
      updateData.quaTrinhBenhLy = payload.quaTrinhBenhLy;
    }

    if (payload.tienSuBanThan !== undefined) {
      updateData.tienSuBanThan = payload.tienSuBanThan;
    }

    if (payload.tienSuGiaDinh !== undefined) {
      updateData.tienSuGiaDinh = payload.tienSuGiaDinh;
    }

    if (payload.khamToanThan !== undefined) {
      updateData.khamToanThan = payload.khamToanThan;
    }

    if (payload.khamBoPhan !== undefined) {
      updateData.khamBoPhan = payload.khamBoPhan;
    }

    if (payload.mach !== undefined) {
      updateData.mach = payload.mach;
    }

    if (payload.nhietDo !== undefined) {
      updateData.nhietDo = payload.nhietDo;
    }

    if (payload.nhipTho !== undefined) {
      updateData.nhipTho = payload.nhipTho;
    }

    if (payload.canNang !== undefined) {
      updateData.canNang = payload.canNang;
    }

    if (payload.chieuCao !== undefined) {
      updateData.chieuCao = payload.chieuCao;
    }

    if (payload.huyetApTThu !== undefined) {
      updateData.huyetApTThu = payload.huyetApTThu;
    }

    if (payload.huyetApTTr !== undefined) {
      updateData.huyetApTTr = payload.huyetApTTr;
    }

    if (payload.bmi !== undefined) {
      updateData.bmi = payload.bmi;
    }

    if (payload.phuongPhapDieuTri !== undefined) {
      updateData.phuongPhapDieuTri = payload.phuongPhapDieuTri;
    }

    if (payload.xuTri !== undefined) {
      updateData.xuTri = payload.xuTri;
    }

    const medicalExamination = await prisma.phieuKhamBenh.update({
      where: { id },
      data: updateData,
      select: medicalExaminationSelect,
    });

    return Send.success(
      res,
      { medicalExamination: mapMedicalExamination(medicalExamination) },
      "Cập nhật phiếu khám bệnh thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Phiếu khám bệnh đã tồn tại");
      }

      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phiếu khám bệnh");
      }

      if (error.code === "P2003") {
        return Send.badRequest(res, null, "Thông tin liên kết không hợp lệ");
      }
    }

    return next(error);
  }
};

const updateDiagnosis = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: MedicalExaminationParam =
      medicalExaminationSchema.medicalExaminationParam.parse(req.params);
    const { diagnoses } = medicalExaminationSchema.updateDiagnosisBody.parse(
      req.body,
    );

    const examination = await prisma.phieuKhamBenh.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!examination) {
      return Send.notFound(res, null, "Không tìm thấy phiếu khám bệnh");
    }

    const uniqueDiseaseIds = Array.from(new Set(diagnoses.map((d) => d.benhId)));

    if (uniqueDiseaseIds.length > 0) {
      const diseases = await prisma.benh.findMany({
        where: { id: { in: uniqueDiseaseIds } },
        select: { id: true },
      });

      if (diseases.length !== uniqueDiseaseIds.length) {
        return Send.badRequest(res, null, "Tồn tại bệnh không hợp lệ trong danh sách");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.chanDoan.deleteMany({ where: { pkbId: id } });

      if (diagnoses.length > 0) {
        await tx.chanDoan.createMany({
          data: diagnoses.map((diagnosis) => ({
            pkbId: id,
            benhId: diagnosis.benhId,
            benhChinh: diagnosis.benhChinh,
          })),
        });
      }
    });

    const medicalExamination = await prisma.phieuKhamBenh.findUnique({
      where: { id },
      select: medicalExaminationSelect,
    });

    if (!medicalExamination) {
      return Send.notFound(res, null, "Không tìm thấy phiếu khám bệnh");
    }

    return Send.success(
      res,
      { medicalExamination: mapMedicalExamination(medicalExamination) },
      "Cập nhật chẩn đoán thành công",
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

const deleteMedicalExamination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: MedicalExaminationParam =
      medicalExaminationSchema.medicalExaminationParam.parse(req.params);

    await prisma.phieuKhamBenh.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa phiếu khám bệnh thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy phiếu khám bệnh");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa phiếu khám bệnh vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getMedicalExamination,
  createMedicalExamination,
  updateMedicalExamination,
  updateDiagnosis,
  deleteMedicalExamination,
};
