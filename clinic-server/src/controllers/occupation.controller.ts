import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import occupationSchema from "../validations/occupation.schema";
import { z } from "zod";

const occupationSelect = {
  id: true,
  maNgheNghiep: true,
  tenNgheNghiep: true,
} satisfies Prisma.NgheNghiepSelect;

type OccupationResult = Prisma.NgheNghiepGetPayload<{
  select: typeof occupationSelect;
}>;

type AddOccupationBody = z.infer<
  typeof occupationSchema.addOccupationBody
>;
type UpdateOccupationBody = z.infer<
  typeof occupationSchema.updateOccupationBody
>;
type OccupationParam = z.infer<typeof occupationSchema.occupationParam>;
type GetOccupationsQuery = z.infer<
  typeof occupationSchema.getOccupationsQuery
>;

const mapOccupation = (occupation: OccupationResult) => ({
  id: occupation.id,
  maNgheNghiep: occupation.maNgheNghiep,
  tenNgheNghiep: occupation.tenNgheNghiep,
});

const getOccupations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page, limit, search }: GetOccupationsQuery =
      occupationSchema.getOccupationsQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.NgheNghiepWhereInput = {};

    if (search) {
      where.OR = [
        { maNgheNghiep: { contains: search, mode: "insensitive" } },
        { tenNgheNghiep: { contains: search, mode: "insensitive" } },
      ];
    }

    const [occupations, total] = await Promise.all([
      prisma.ngheNghiep.findMany({
        where,
        select: occupationSelect,
        skip,
        take: limit,
        orderBy: { tenNgheNghiep: "asc" },
      }),
      prisma.ngheNghiep.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      occupations: occupations.map(mapOccupation),
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

const getOccupation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: OccupationParam =
      occupationSchema.occupationParam.parse(req.params);

    const occupation = await prisma.ngheNghiep.findUnique({
      where: { id },
      select: occupationSelect,
    });

    if (!occupation) {
      return Send.notFound(res, null, "Không tìm thấy nghề nghiệp");
    }

    return Send.success(res, { occupation: mapOccupation(occupation) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    return next(error);
  }
};

const addOccupation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload: AddOccupationBody =
      occupationSchema.addOccupationBody.parse(req.body);

    const maNgheNghiep = payload.maNgheNghiep.trim().toUpperCase();
    const tenNgheNghiep = payload.tenNgheNghiep.trim();

    const [codeConflict, nameConflict] = await Promise.all([
      prisma.ngheNghiep.findFirst({
        where: { maNgheNghiep },
        select: { id: true },
      }),
      prisma.ngheNghiep.findFirst({
        where: { tenNgheNghiep },
        select: { id: true },
      }),
    ]);

    if (codeConflict) {
      return Send.badRequest(res, null, "Mã nghề nghiệp đã tồn tại");
    }

    if (nameConflict) {
      return Send.badRequest(res, null, "Tên nghề nghiệp đã tồn tại");
    }

    const occupation = await prisma.ngheNghiep.create({
      data: {
        maNgheNghiep,
        tenNgheNghiep,
      },
      select: occupationSelect,
    });

    return Send.success(
      res,
      { occupation: mapOccupation(occupation) },
      "Tạo nghề nghiệp thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Nghề nghiệp đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateOccupation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: OccupationParam =
      occupationSchema.occupationParam.parse(req.params);
    const payload: UpdateOccupationBody =
      occupationSchema.updateOccupationBody.parse(req.body);

    const existing = await prisma.ngheNghiep.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Send.notFound(res, null, "Không tìm thấy nghề nghiệp");
    }

    const updateData: Prisma.NgheNghiepUpdateInput = {};

    if (payload.maNgheNghiep !== undefined) {
      const maNgheNghiep = payload.maNgheNghiep.trim().toUpperCase();

      const codeConflict = await prisma.ngheNghiep.findFirst({
        where: {
          maNgheNghiep,
          NOT: { id },
        },
        select: { id: true },
      });

      if (codeConflict) {
        return Send.badRequest(res, null, "Mã nghề nghiệp đã tồn tại");
      }

      updateData.maNgheNghiep = maNgheNghiep;
    }

    if (payload.tenNgheNghiep !== undefined) {
      const tenNgheNghiep = payload.tenNgheNghiep.trim();

      const nameConflict = await prisma.ngheNghiep.findFirst({
        where: {
          tenNgheNghiep,
          NOT: { id },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return Send.badRequest(res, null, "Tên nghề nghiệp đã tồn tại");
      }

      updateData.tenNgheNghiep = tenNgheNghiep;
    }

    const occupation = await prisma.ngheNghiep.update({
      where: { id },
      data: updateData,
      select: occupationSelect,
    });

    return Send.success(
      res,
      { occupation: mapOccupation(occupation) },
      "Cập nhật nghề nghiệp thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Nghề nghiệp đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy nghề nghiệp");
      }
    }

    return next(error);
  }
};

const deleteOccupation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: OccupationParam =
      occupationSchema.occupationParam.parse(req.params);

    await prisma.ngheNghiep.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa nghề nghiệp thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy nghề nghiệp");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa nghề nghiệp vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getOccupations,
  getOccupation,
  addOccupation,
  updateOccupation,
  deleteOccupation,
};
