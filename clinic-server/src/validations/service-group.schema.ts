import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Tên nhóm dịch vụ là bắt buộc")
  .max(100, "Tên nhóm dịch vụ không vượt quá 100 ký tự");

const addServiceGroupBody = z.object({
  tenNhomDV: nameSchema,
  loaiDichVuId: z.coerce
    .number()
    .int("Loại dịch vụ không hợp lệ")
    .min(1, "Loại dịch vụ không hợp lệ"),
});

const updateServiceGroupBody = addServiceGroupBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const serviceGroupParam = z.object({
  id: z.coerce
    .number()
    .int("Nhóm dịch vụ không hợp lệ")
    .min(1, "Nhóm dịch vụ không hợp lệ"),
});

const getServiceGroupsQuery = z.object({
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
  loaiDichVuId: z.coerce
    .number()
    .int("Loại dịch vụ không hợp lệ")
    .min(1, "Loại dịch vụ không hợp lệ")
    .optional(),
});

const serviceGroupSchema = {
  addServiceGroupBody,
  updateServiceGroupBody,
  serviceGroupParam,
  getServiceGroupsQuery,
};

export default serviceGroupSchema;
