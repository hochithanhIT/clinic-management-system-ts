import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import referenceSchema, {
  referenceIdParam,
  titleBody,
  updateTitleBody,
} from "../validations/reference.schema";
import { z } from "zod";

const titleSelect = {
  id: true,
  tenChucDanh: true,
} satisfies Prisma.ChucDanhSelect;

type GetTitlesQuery = z.infer<typeof referenceSchema.paginationQuery>;
type AddTitleBody = z.infer<typeof titleBody>;
type UpdateTitleBody = z.infer<typeof updateTitleBody>;
type TitleParam = z.infer<typeof referenceIdParam>;

const getTitles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search }: GetTitlesQuery =
      referenceSchema.paginationQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.ChucDanhWhereInput = {};

    if (search) {
      where.tenChucDanh = { contains: search, mode: "insensitive" };
    }

    const [titles, total] = await Promise.all([
      prisma.chucDanh.findMany({
        where,
        select: titleSelect,
        skip,
        take: limit,
        orderBy: { tenChucDanh: "asc" },
      }),
      prisma.chucDanh.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      titles,
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

const addTitle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: AddTitleBody = titleBody.parse(req.body);

    const tenChucDanh = payload.tenChucDanh.trim();

    const existing = await prisma.chucDanh.findFirst({
      where: { tenChucDanh },
      select: { id: true },
    });

    if (existing) {
      return Send.badRequest(res, null, "Title name already exists");
    }

    const title = await prisma.chucDanh.create({
      data: { tenChucDanh },
      select: titleSelect,
    });

    return Send.success(res, { title }, "Title created successfully");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Title already exists");
      }
    }

    return next(error);
  }
};

const updateTitle = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: TitleParam = referenceIdParam.parse(req.params);
    const payload: UpdateTitleBody = updateTitleBody.parse(req.body);

    const existing = await prisma.chucDanh.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Send.notFound(res, null, "Title not found");
    }

    const updateData: Prisma.ChucDanhUpdateInput = {};

    if (payload.tenChucDanh !== undefined) {
      const tenChucDanh = payload.tenChucDanh.trim();

      const duplicate = await prisma.chucDanh.findFirst({
        where: {
          tenChucDanh,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return Send.badRequest(res, null, "Title name already exists");
      }

      updateData.tenChucDanh = tenChucDanh;
    }

    const title = await prisma.chucDanh.update({
      where: { id },
      data: updateData,
      select: titleSelect,
    });

    return Send.success(res, { title }, "Title updated successfully");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Title already exists");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Title not found");
      }
    }

    return next(error);
  }
};

const deleteTitle = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id }: TitleParam = referenceIdParam.parse(req.params);

    await prisma.chucDanh.delete({
      where: { id },
    });

    return Send.success(res, null, "Title deleted successfully");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Title not found");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Unable to delete title because it is in use",
        );
      }
    }

    return next(error);
  }
};

export default {
  getTitles,
  addTitle,
  updateTitle,
  deleteTitle,
};
