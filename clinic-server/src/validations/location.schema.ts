import { z } from "zod";

const basePagination = {
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .max(1000, "Page must not exceed 1000")
    .default(1),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),
  search: z
    .string()
    .trim()
    .max(100, "Search term must not exceed 100 characters")
    .optional()
    .transform((value) => (value ? value : undefined)),
};

const getCitiesQuery = z.object(basePagination);

const getProvincesQuery = z
  .object({
    ...basePagination,
    cityId: z.coerce
      .number()
      .int("City/Province is invalid")
      .min(1, "City/Province is invalid")
      .optional(),
    provinceId: z.coerce
      .number()
      .int("City/Province is invalid")
      .min(1, "City/Province is invalid")
      .optional(),
  })
  .transform(({ cityId, provinceId, ...rest }) => ({
    ...rest,
    cityId: cityId ?? provinceId,
  }));

const addCityBody = z.object({
  maTinhTP: z
    .string()
    .trim()
    .min(1, "City/Province code is required")
    .max(20, "City/Province code must not exceed 20 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "City/Province code may only contain letters, numbers, hyphens, and underscores")
    .transform((value) => value.toUpperCase()),
  tenTinhTP: z
    .string()
    .trim()
    .min(1, "City/Province name is required")
    .max(100, "City/Province name must not exceed 100 characters"),
});

const addProvinceBody = z.object({
  maXaPhuong: z
    .string()
    .trim()
    .min(1, "Ward/Commune code is required")
    .max(20, "Ward/Commune code must not exceed 20 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Ward/Commune code may only contain letters, numbers, hyphens, and underscores")
    .transform((value) => value.toUpperCase()),
  tenXaPhuong: z
    .string()
    .trim()
    .min(1, "Ward/Commune name is required")
    .max(100, "Ward/Commune name must not exceed 100 characters"),
  tinhTPId: z.coerce
    .number()
    .int("City/Province is invalid")
    .min(1, "City/Province is invalid"),
});

const provinceParam = z.object({
  id: z.coerce
    .number()
    .int("Ward/Commune is invalid")
    .min(1, "Ward/Commune is invalid"),
});

const cityParam = z.object({
  id: z.coerce
    .number()
    .int("City/Province is invalid")
    .min(1, "City/Province is invalid"),
});

const updateCityBody = addCityBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const updateProvinceBody = addProvinceBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const locationSchema = {
  getCitiesQuery,
  getProvincesQuery,
  addCityBody,
  addProvinceBody,
  updateProvinceBody,
  updateCityBody,
  provinceParam,
  cityParam,
};

export default locationSchema;
