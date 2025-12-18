import { z } from "zod";

const getDepartmentsQuery = z.object({
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
  status: z
    .enum(["active", "inactive"])
    .optional()
    .transform((value) => (value ? value : undefined)),
});

const addDepartmentBody = z.object({
  tenKhoa: z
    .string()
    .trim()
    .min(1, "Department name is required")
    .max(100, "Department name must not exceed 100 characters"),
});

const departmentParam = z.object({
  id: z.coerce
    .number()
    .int("Department is invalid")
    .min(1, "Department is invalid"),
});

const updateDepartmentBody = addDepartmentBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const departmentSchema = {
  getDepartmentsQuery,
  addDepartmentBody,
  departmentParam,
  updateDepartmentBody,
};

export default departmentSchema;
