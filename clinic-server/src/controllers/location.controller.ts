import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import Send from "../utils/response.utils";
import locationSchema from "../validations/location.schema";
import { z } from "zod";

type GetProvincesQuery = z.infer<typeof locationSchema.getProvincesQuery>;
type GetCitiesQuery = z.infer<typeof locationSchema.getCitiesQuery>;
type AddProvinceBody = z.infer<typeof locationSchema.addProvinceBody>;
type UpdateProvinceBody = z.infer<typeof locationSchema.updateProvinceBody>;
type ProvinceParam = z.infer<typeof locationSchema.provinceParam>;
type AddCityBody = z.infer<typeof locationSchema.addCityBody>;
type UpdateCityBody = z.infer<typeof locationSchema.updateCityBody>;
type CityParam = z.infer<typeof locationSchema.cityParam>;

const citySelect = {
  id: true,
  maTinhTP: true,
  tenTinhTP: true,
} satisfies Prisma.TinhTPSelect;

const provinceSelect = {
  id: true,
  maXaPhuong: true,
  tenXaPhuong: true,
  tinhTP: {
    select: {
      id: true,
      maTinhTP: true,
      tenTinhTP: true,
    },
  },
} satisfies Prisma.XaPhuongSelect;

type CityResult = Prisma.TinhTPGetPayload<{ select: typeof citySelect }>;
type ProvinceResult = Prisma.XaPhuongGetPayload<{ select: typeof provinceSelect }>;

const mapCity = (city: CityResult) => ({
  id: city.id,
  maTinhTP: city.maTinhTP,
  tenTinhTP: city.tenTinhTP,
});

const mapProvince = (province: ProvinceResult) => ({
  id: province.id,
  maXaPhuong: province.maXaPhuong,
  tenXaPhuong: province.tenXaPhuong,
  city: province.tinhTP
    ? {
        id: province.tinhTP.id,
        maTinhTP: province.tinhTP.maTinhTP,
        tenTinhTP: province.tinhTP.tenTinhTP,
      }
    : null,
});

const getProvinces = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, search, cityId }: GetProvincesQuery =
      locationSchema.getProvincesQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.XaPhuongWhereInput = {};

    if (search) {
      where.tenXaPhuong = { contains: search, mode: "insensitive" };
    }

    if (cityId !== undefined) {
      where.tinhTPId = cityId;
    }

    const [provinces, total] = await Promise.all([
      prisma.xaPhuong.findMany({
        where,
        select: provinceSelect,
        skip,
        take: limit,
        orderBy: { id: "asc" },
      }),
      prisma.xaPhuong.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      provinces: provinces.map(mapProvince),
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

const getCities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, limit, search }: GetCitiesQuery =
      locationSchema.getCitiesQuery.parse(req.query);

    const skip = (page - 1) * limit;
    const where: Prisma.TinhTPWhereInput = {};

    if (search) {
      where.tenTinhTP = { contains: search, mode: "insensitive" };
    }

    const [cities, total] = await Promise.all([
      prisma.tinhTP.findMany({
        where,
        select: citySelect,
        skip,
        take: limit,
        orderBy: { id: "asc" },
      }),
      prisma.tinhTP.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return Send.success(res, {
      cities: cities.map(mapCity),
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

const addProvince = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload: AddProvinceBody = locationSchema.addProvinceBody.parse(
      req.body,
    );

    const maXaPhuong = payload.maXaPhuong.trim();
    const tenXaPhuong = payload.tenXaPhuong.trim();

    const city = await prisma.tinhTP.findUnique({
      where: { id: payload.tinhTPId },
      select: { id: true, tenTinhTP: true },
    });

    if (!city) {
      return Send.badRequest(res, null, "Tỉnh/thành phố không tồn tại");
    }

    const [codeConflict, nameConflict] = await Promise.all([
      prisma.xaPhuong.findFirst({
        where: { maXaPhuong },
        select: { id: true },
      }),
      prisma.xaPhuong.findFirst({
        where: { tenXaPhuong, tinhTPId: payload.tinhTPId },
        select: { id: true },
      }),
    ]);

    if (codeConflict) {
      return Send.badRequest(res, null, "Mã xã/phường đã tồn tại");
    }

    if (nameConflict) {
      return Send.badRequest(
        res,
        null,
        "Tên xã/phường đã tồn tại trong tỉnh/thành phố",
      );
    }

    const province = await prisma.xaPhuong.create({
      data: {
        maXaPhuong,
        tenXaPhuong,
        tinhTP: { connect: { id: payload.tinhTPId } },
      },
      select: provinceSelect,
    });

    return Send.success(
      res,
      { province: mapProvince(province) },
      "Tạo xã/phường thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Xã/phường đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateProvince = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: ProvinceParam = locationSchema.provinceParam.parse(
      req.params,
    );
    const payload: UpdateProvinceBody =
      locationSchema.updateProvinceBody.parse(req.body);

    const existingProvince = await prisma.xaPhuong.findUnique({
      where: { id },
      select: { id: true, tinhTPId: true },
    });

    if (!existingProvince) {
      return Send.notFound(res, null, "Không tìm thấy xã/phường");
    }

    const updateData: Prisma.XaPhuongUpdateInput = {};

    let targetCityId = existingProvince.tinhTPId;

    if (payload.tinhTPId !== undefined) {
      const city = await prisma.tinhTP.findUnique({
        where: { id: payload.tinhTPId },
        select: { id: true },
      });

      if (!city) {
        return Send.badRequest(res, null, "Tỉnh/thành phố không tồn tại");
      }

      targetCityId = payload.tinhTPId;
      updateData.tinhTP = { connect: { id: payload.tinhTPId } };
    }

    if (payload.maXaPhuong !== undefined) {
      const maXaPhuong = payload.maXaPhuong.trim();

      const codeConflict = await prisma.xaPhuong.findFirst({
        where: {
          maXaPhuong,
          NOT: { id },
        },
        select: { id: true },
      });

      if (codeConflict) {
        return Send.badRequest(res, null, "Mã xã/phường đã tồn tại");
      }

      updateData.maXaPhuong = maXaPhuong;
    }

    if (payload.tenXaPhuong !== undefined) {
      const tenXaPhuong = payload.tenXaPhuong.trim();

      const nameConflict = await prisma.xaPhuong.findFirst({
        where: {
          tenXaPhuong,
          tinhTPId: targetCityId,
          NOT: { id },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return Send.badRequest(
          res,
          null,
          "Tên xã/phường đã tồn tại trong tỉnh/thành phố",
        );
      }

      updateData.tenXaPhuong = tenXaPhuong;
    }

    const province = await prisma.xaPhuong.update({
      where: { id },
      data: updateData,
      select: provinceSelect,
    });

    return Send.success(
      res,
      { province: mapProvince(province) },
      "Cập nhật xã/phường thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Xã/phường đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy xã/phường");
      }
    }

    return next(error);
  }
};

const deleteProvince = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: ProvinceParam = locationSchema.provinceParam.parse(
      req.params,
    );

    await prisma.xaPhuong.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa xã/phường thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy xã/phường");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa xã/phường vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

const addCity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload: AddCityBody = locationSchema.addCityBody.parse(req.body);

    const maTinhTP = payload.maTinhTP.trim();
    const tenTinhTP = payload.tenTinhTP.trim();

    const [codeConflict, nameConflict] = await Promise.all([
      prisma.tinhTP.findFirst({
        where: { maTinhTP },
        select: { id: true },
      }),
      prisma.tinhTP.findFirst({
        where: { tenTinhTP },
        select: { id: true },
      }),
    ]);

    if (codeConflict) {
      return Send.badRequest(res, null, "Mã tỉnh/thành phố đã tồn tại");
    }

    if (nameConflict) {
      return Send.badRequest(res, null, "Tên tỉnh/thành phố đã tồn tại");
    }

    const city = await prisma.tinhTP.create({
      data: { maTinhTP, tenTinhTP },
      select: citySelect,
    });

    return Send.success(
      res,
      { city: mapCity(city) },
      "Tạo tỉnh/thành phố thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tỉnh/thành phố đã tồn tại");
      }
    }

    return next(error);
  }
};

const updateCity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: CityParam = locationSchema.cityParam.parse(req.params);
    const payload: UpdateCityBody = locationSchema.updateCityBody.parse(
      req.body,
    );

    const existingCity = await prisma.tinhTP.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingCity) {
      return Send.notFound(res, null, "Không tìm thấy tỉnh/thành phố");
    }

    const updateData: Prisma.TinhTPUpdateInput = {};

    if (payload.maTinhTP !== undefined) {
      const maTinhTP = payload.maTinhTP.trim();

      const codeConflict = await prisma.tinhTP.findFirst({
        where: {
          maTinhTP,
          NOT: { id },
        },
        select: { id: true },
      });

      if (codeConflict) {
        return Send.badRequest(res, null, "Mã tỉnh/thành phố đã tồn tại");
      }

      updateData.maTinhTP = maTinhTP;
    }

    if (payload.tenTinhTP !== undefined) {
      const tenTinhTP = payload.tenTinhTP.trim();

      const nameConflict = await prisma.tinhTP.findFirst({
        where: {
          tenTinhTP,
          NOT: { id },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return Send.badRequest(res, null, "Tên tỉnh/thành phố đã tồn tại");
      }

      updateData.tenTinhTP = tenTinhTP;
    }

    const city = await prisma.tinhTP.update({
      where: { id },
      data: updateData,
      select: citySelect,
    });

    return Send.success(
      res,
      { city: mapCity(city) },
      "Cập nhật tỉnh/thành phố thành công",
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Send.badRequest(res, null, "Tỉnh/thành phố đã tồn tại");
      }
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy tỉnh/thành phố");
      }
    }

    return next(error);
  }
};

const deleteCity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id }: CityParam = locationSchema.cityParam.parse(req.params);

    await prisma.tinhTP.delete({
      where: { id },
    });

    return Send.success(res, null, "Xóa tỉnh/thành phố thành công");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Send.validationErrors(res, error.flatten().fieldErrors);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return Send.notFound(res, null, "Không tìm thấy tỉnh/thành phố");
      }

      if (error.code === "P2003") {
        return Send.badRequest(
          res,
          null,
          "Không thể xóa tỉnh/thành phố vì đang được sử dụng",
        );
      }
    }

    return next(error);
  }
};

export default {
  getProvinces,
  getCities,
  addProvince,
  updateProvince,
  deleteProvince,
  addCity,
  updateCity,
  deleteCity,
};
