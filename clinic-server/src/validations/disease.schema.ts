import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Mã ICD10 không được để trống")
  .max(20, "Mã ICD10 không được vượt quá 20 ký tự")
  .regex(/^[A-Za-z0-9._-]+$/, "Mã ICD10 chỉ được chứa chữ, số, dấu chấm, gạch ngang và gạch dưới")
  .transform((value) => value.toUpperCase());

const nameSchema = z
  .string()
  .trim()
  .min(1, "Tên bệnh không được để trống")
  .max(255, "Tên bệnh không được vượt quá 255 ký tự");

const addDiseaseBody = z.object({
  maICD10: codeSchema,
  tenBenh: nameSchema,
});

const updateDiseaseBody = addDiseaseBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const diseaseParam = z.object({
  id: z.coerce
    .number()
    .int("Bệnh không hợp lệ")
    .min(1, "Bệnh không hợp lệ"),
});

const getDiseasesQuery = z.object({
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

const diseaseSchema = {
  addDiseaseBody,
  updateDiseaseBody,
  diseaseParam,
  getDiseasesQuery,
};

export default diseaseSchema;
