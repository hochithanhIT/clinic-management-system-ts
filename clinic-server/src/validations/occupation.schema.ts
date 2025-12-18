import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Occupation code is required")
  .max(20, "Occupation code must not exceed 20 characters")
  .regex(/^[A-Za-z0-9._-]+$/, "Occupation code may only contain letters, numbers, periods, hyphens, and underscores")
  .transform((value) => value.toUpperCase());

const nameSchema = z
  .string()
  .trim()
  .min(1, "Occupation name is required")
  .max(255, "Occupation name must not exceed 255 characters");

const addOccupationBody = z.object({
  maNgheNghiep: codeSchema,
  tenNgheNghiep: nameSchema,
});

const updateOccupationBody = addOccupationBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const occupationParam = z.object({
  id: z.coerce
    .number()
    .int("Occupation is invalid")
    .min(1, "Occupation is invalid"),
});

const getOccupationsQuery = z.object({
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
});

const occupationSchema = {
  addOccupationBody,
  updateOccupationBody,
  occupationParam,
  getOccupationsQuery,
};

export default occupationSchema;
