import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Tên loại dịch vụ là bắt buộc")
  .max(100, "Tên loại dịch vụ không vượt quá 100 ký tự");

const addServiceTypeBody = z.object({
  tenLoai: nameSchema,
});

const updateServiceTypeBody = addServiceTypeBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const serviceTypeParam = z.object({
  id: z.coerce
    .number()
    .int("Loại dịch vụ không hợp lệ")
    .min(1, "Loại dịch vụ không hợp lệ"),
});

const serviceTypeSchema = {
  addServiceTypeBody,
  updateServiceTypeBody,
  serviceTypeParam,
};

export default serviceTypeSchema;
