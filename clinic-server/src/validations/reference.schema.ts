import { z } from "zod";

export const paginationQuery = z.object({
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

export const positionBody = z.object({
  tenChucVu: z
    .string()
    .trim()
    .min(1, "Position name is required")
    .max(100, "Position name must not exceed 100 characters"),
});

export const referenceIdParam = z.object({
  id: z.coerce
    .number()
    .int("ID is invalid")
    .min(1, "ID is invalid"),
});

export const updatePositionBody = positionBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

export const roleBody = z.object({
  tenVaiTro: z
    .string()
    .trim()
    .min(1, "Role name is required")
    .max(100, "Role name must not exceed 100 characters"),
});

export const updateRoleBody = roleBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

export const titleBody = z.object({
  tenChucDanh: z
    .string()
    .trim()
    .min(1, "Title name is required")
    .max(100, "Title name must not exceed 100 characters"),
});

export const updateTitleBody = titleBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const referenceSchema = {
  paginationQuery,
  positionBody,
  updatePositionBody,
  referenceIdParam,
  roleBody,
  updateRoleBody,
  titleBody,
  updateTitleBody,
};

export default referenceSchema;
