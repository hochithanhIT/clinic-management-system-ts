import { z } from "zod";

const getUsersQuery = z.object({
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
  departmentId: z.coerce
    .number()
    .int("Department is invalid")
    .min(1, "Department is invalid")
    .optional(),
  roleId: z.coerce
    .number()
    .int("Role is invalid")
    .min(1, "Role is invalid")
    .optional(),
});

const getUserParam = z.object({
  id: z.coerce
    .number()
    .int("ID must be an integer")
    .min(1, "ID must be greater than or equal to 1"),
});

const baseUserBody = {
  hoTen: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must not exceed 100 characters"),
  ngaySinh: z.coerce
    .date()
    .max(new Date(), "Date of birth cannot be in the future"),
  gioiTinh: z.coerce
    .number()
    .int("Gender must be an integer")
    .refine((value) => [0, 1].includes(value), "Gender is invalid"),
  sdt: z
    .string()
    .trim()
    .regex(/^\d{9,15}$/, "Phone number must contain between 9 and 15 digits"),
  soChungChiHanhNghe: z
    .string()
    .trim()
    .max(50, "License number must not exceed 50 characters")
    .optional(),
  ngayCapChungChi: z.coerce.date().optional(),
  ngayHetHanChungChi: z.coerce.date().optional(),
  daXoa: z.coerce.boolean().optional(),
  khoaId: z.coerce
    .number()
    .int("Department is invalid")
    .min(1, "Department is invalid"),
  chucDanhId: z.coerce
    .number()
    .int("Title is invalid")
    .min(1, "Title is invalid")
    .optional(),
  chucVuId: z.coerce
    .number()
    .int("Position is invalid")
    .min(1, "Position is invalid")
    .optional(),
  vaiTroId: z.coerce
    .number()
    .int("Role is invalid")
    .min(1, "Role is invalid"),
};

const createUserBody = z.object(baseUserBody);

const updateUserBody = z
  .object({
    maNV: z
      .string()
      .trim()
      .min(1, "Employee code is required")
      .max(30, "Employee code must not exceed 30 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Employee code may only contain letters, numbers, hyphens, and underscores"),
    ...baseUserBody,
  })
  .partial()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: "No data to update",
      path: ["global"],
    }
  );

const userSchema = {
  getUsersQuery,
  getUserParam,
  createUserBody,
  updateUserBody,
};

export default userSchema;
