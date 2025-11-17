import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Mã nghề nghiệp không được để trống")
  .max(20, "Mã nghề nghiệp không được vượt quá 20 ký tự")
  .regex(/^[A-Za-z0-9._-]+$/, "Mã nghề nghiệp chỉ được chứa chữ, số, dấu chấm, gạch ngang và gạch dưới")
  .transform((value) => value.toUpperCase());

const nameSchema = z
  .string()
  .trim()
  .min(1, "Tên nghề nghiệp không được để trống")
  .max(255, "Tên nghề nghiệp không được vượt quá 255 ký tự");

const addOccupationBody = z.object({
  maNgheNghiep: codeSchema,
  tenNgheNghiep: nameSchema,
});

const updateOccupationBody = addOccupationBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const occupationParam = z.object({
  id: z.coerce
    .number()
    .int("Nghề nghiệp không hợp lệ")
    .min(1, "Nghề nghiệp không hợp lệ"),
});

const getOccupationsQuery = z.object({
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

const occupationSchema = {
  addOccupationBody,
  updateOccupationBody,
  occupationParam,
  getOccupationsQuery,
};

export default occupationSchema;
