import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce
    .number()
    .int("Trang phải là số nguyên")
    .min(1, "Trang phải từ 1 trở lên")
    .max(1000, "Trang không được vượt quá 1000")
    .default(1),
  limit: z.coerce
    .number()
    .int("Giới hạn phải là số nguyên")
    .min(1, "Giới hạn phải từ 1 trở lên")
    .max(100, "Giới hạn không được vượt quá 100")
    .default(20),
  search: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm không được vượt quá 100 ký tự")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const positionBody = z.object({
  tenChucVu: z
    .string()
    .trim()
    .min(1, "Tên chức vụ không được để trống")
    .max(100, "Tên chức vụ không được vượt quá 100 ký tự"),
});

export const referenceIdParam = z.object({
  id: z.coerce
    .number()
    .int("ID không hợp lệ")
    .min(1, "ID không hợp lệ"),
});

export const updatePositionBody = positionBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

export const roleBody = z.object({
  tenVaiTro: z
    .string()
    .trim()
    .min(1, "Tên vai trò không được để trống")
    .max(100, "Tên vai trò không được vượt quá 100 ký tự"),
});

export const updateRoleBody = roleBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

export const titleBody = z.object({
  tenChucDanh: z
    .string()
    .trim()
    .min(1, "Tên chức danh không được để trống")
    .max(100, "Tên chức danh không được vượt quá 100 ký tự"),
});

export const updateTitleBody = titleBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
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
