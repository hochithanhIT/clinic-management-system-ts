import { z } from "zod";

const getServicesQuery = z.object({
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
    .default(10),
  search: z
    .string()
    .trim()
    .max(100, "Search term must not exceed 100 characters")
    .optional()
    .transform((value) => (value ? value : undefined)),
  nhomDichVuId: z.coerce
    .number()
    .int("Service group is invalid")
    .min(1, "Service group is invalid")
    .optional(),
  loaiDichVuId: z.coerce
    .number()
    .int("Service type is invalid")
    .min(1, "Service type is invalid")
    .optional(),
});

const serviceParam = z.object({
  id: z.coerce
    .number()
    .int("Service is invalid")
    .min(1, "Service is invalid"),
});

const addServiceBody = z.object({
  maDV: z
    .string()
    .trim()
    .min(1, "Service code is required")
    .max(30, "Service code must not exceed 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Service code may only contain letters, numbers, hyphens, and underscores")
    .transform((value) => value.toUpperCase()),
  tenDV: z
    .string()
    .trim()
    .min(1, "Service name is required")
    .max(200, "Service name must not exceed 200 characters"),
  donVi: z
    .string()
    .trim()
    .max(50, "Unit must not exceed 50 characters")
    .optional(),
  donGia: z.coerce
    .number()
    .min(0, "Unit price cannot be negative"),
  thamChieuMin: z
    .string()
    .trim()
    .max(100, "Reference value must not exceed 100 characters")
    .optional(),
  thamChieuMax: z
    .string()
    .trim()
    .max(100, "Reference value must not exceed 100 characters")
    .optional(),
  nhomDichVuId: z.coerce
    .number()
    .int("Service group is invalid")
    .min(1, "Service group is invalid"),
  phongThucHienId: z
    .union([
      z.coerce
        .number()
        .int("Performing room is invalid")
        .min(1, "Performing room is invalid"),
      z.null(),
    ])
    .optional(),
});

const updateServiceBody = addServiceBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const serviceSchema = {
  getServicesQuery,
  serviceParam,
  addServiceBody,
  updateServiceBody,
};

export default serviceSchema;
