import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import diseaseSchema from "../validations/disease.schema";
import { z } from "zod";

const diseaseSelect = {
  id: true,
  maICD10: true,
  tenBenh: true,
} satisfies Prisma.BenhSelect;

type AddDiseaseBody = z.infer<typeof diseaseSchema.addDiseaseBody>;
type UpdateDiseaseBody = z.infer<typeof diseaseSchema.updateDiseaseBody>;
type DiseaseParam = z.infer<typeof diseaseSchema.diseaseParam>;
type GetDiseasesQuery = z.infer<typeof diseaseSchema.getDiseasesQuery>;

type DiseaseResult = Prisma.BenhGetPayload<{ select: typeof diseaseSelect }>;

const mapDisease = (disease: DiseaseResult) => ({
  id: disease.id,
  maICD10: disease.maICD10,
  tenBenh: disease.tenBenh,
});

const getDiseases = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search }: GetDiseasesQuery =
      diseaseSchema.getDiseasesQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.BenhWhereInput = {};

    if (search) {
      where.OR = [
        { maICD10: { contains: search, mode: "insensitive" } },
        { tenBenh: { contains: search, mode: "insensitive" } },
      ];
    }

    const [diseases, total] = await Promise.all([
      prisma.benh.findMany({
        where,
        select: diseaseSelect,
        skip,
        take: limit,
        orderBy: { maICD10: "asc" },
      }),
      prisma.benh.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      diseases: diseases.map(mapDisease),
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

const addDisease = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: AddDiseaseBody = diseaseSchema.addDiseaseBody.parse(req.body);

    const maICD10 = payload.maICD10;
    const tenBenh = payload.tenBenh.trim();

    const [codeConflict, nameConflict] = await Promise.all([
      prisma.benh.findUnique({ where: { maICD10 }, select: { id: true } }),
      prisma.benh.findFirst({ where: { tenBenh }, select: { id: true } }),
    ]);

    if (codeConflict) {
      return Send.badRequest(res, null, "Mã ICD10 đã tồn tại");
    }

    if (nameConflict) {
      return Send.badRequest(res, null, "Tên bệnh đã tồn tại");
    }

    const disease = await prisma.benh.create({
      data: {
        maICD10,
        tenBenh,
      },
      select: diseaseSelect,
    });

    return Send.success(
      res,
      { disease: mapDisease(disease) },
      "Tạo bệnh thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Bệnh đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateDisease = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: DiseaseParam = diseaseSchema.diseaseParam.parse(req.params);
    const payload: UpdateDiseaseBody = diseaseSchema.updateDiseaseBody.parse(
      req.body,
    );

    const existingDisease = await prisma.benh.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingDisease) {
      return Send.notFound(res, null, "Không tìm thấy bệnh");
    }

    const updateData: Prisma.BenhUpdateInput = {};

    if (payload.maICD10 !== undefined) {
      const maICD10 = payload.maICD10;

      const codeConflict = await prisma.benh.findFirst({
        where: {
          maICD10,
          NOT: { id },
        },
        select: { id: true },
      });

      if (codeConflict) {
        return Send.badRequest(res, null, "Mã ICD10 đã tồn tại");
      }

      updateData.maICD10 = maICD10;
    }

    if (payload.tenBenh !== undefined) {
      const tenBenh = payload.tenBenh.trim();

      const nameConflict = await prisma.benh.findFirst({
        where: {
          tenBenh,
          NOT: { id },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return Send.badRequest(res, null, "Tên bệnh đã tồn tại");
      }

      updateData.tenBenh = tenBenh;
    }

    const disease = await prisma.benh.update({
      where: { id },
      data: updateData,
      select: diseaseSelect,
    });

    return Send.success(
      res,
      { disease: mapDisease(disease) },
      "Cập nhật bệnh thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Bệnh đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy bệnh");
      }
    }

    return next(error);
  }
};

const deleteDisease = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: DiseaseParam = diseaseSchema.diseaseParam.parse(req.params);

    await prisma.benh.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa bệnh thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy bệnh");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa bệnh vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getDiseases,
  addDisease,
  updateDisease,
  deleteDisease,
};
