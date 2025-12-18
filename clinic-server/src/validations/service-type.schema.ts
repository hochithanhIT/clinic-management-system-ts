import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Service type name is required")
  .max(100, "Service type name must not exceed 100 characters");

const addServiceTypeBody = z.object({
  tenLoai: nameSchema,
});

const updateServiceTypeBody = addServiceTypeBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const serviceTypeParam = z.object({
  id: z.coerce
    .number()
    .int("Service type is invalid")
    .min(1, "Service type is invalid"),
});

const serviceTypeSchema = {
  addServiceTypeBody,
  updateServiceTypeBody,
  serviceTypeParam,
};

export default serviceTypeSchema;
