import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Service group name is required")
  .max(100, "Service group name must not exceed 100 characters");

const addServiceGroupBody = z.object({
  tenNhomDV: nameSchema,
  loaiDichVuId: z.coerce
    .number()
    .int("Service type is invalid")
    .min(1, "Service type is invalid"),
});

const updateServiceGroupBody = addServiceGroupBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const serviceGroupParam = z.object({
  id: z.coerce
    .number()
    .int("Service group is invalid")
    .min(1, "Service group is invalid"),
});

const getServiceGroupsQuery = z.object({
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
  loaiDichVuId: z.coerce
    .number()
    .int("Service type is invalid")
    .min(1, "Service type is invalid")
    .optional(),
});

const serviceGroupSchema = {
  addServiceGroupBody,
  updateServiceGroupBody,
  serviceGroupParam,
  getServiceGroupsQuery,
};

export default serviceGroupSchema;
