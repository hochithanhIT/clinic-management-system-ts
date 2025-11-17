import { z, ZodIssueCode } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Mã bệnh án không được để trống")
  .max(30, "Mã bệnh án không được vượt quá 30 ký tự")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Mã bệnh án chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới",
  );

const baseMedicalRecordBody = z.object({
  maBA: codeSchema.optional(),
  benhNhanId: z.coerce
    .number()
    .int("Bệnh nhân không hợp lệ")
    .min(1, "Bệnh nhân không hợp lệ"),
  nvTiepNhanId: z.coerce
    .number()
    .int("Nhân viên tiếp nhận không hợp lệ")
    .min(1, "Nhân viên tiếp nhận không hợp lệ"),
  nvKhamId: z
    .union([
      z.coerce
        .number()
        .int("Nhân viên khám bệnh không hợp lệ")
        .min(1, "Nhân viên khám bệnh không hợp lệ"),
      z.null(),
    ])
    .optional(),
  thoiGianVao: z.coerce.date(),
  lyDoKhamBenh: z
    .string()
    .trim()
    .min(1, "Lý do khám bệnh không được để trống")
    .max(500, "Lý do khám bệnh không được vượt quá 500 ký tự"),
  trangThai: z.coerce
    .number()
    .int("Trạng thái không hợp lệ")
    .min(0, "Trạng thái không hợp lệ"),
  thoiGianKetThuc: z
    .union([
      z.coerce.date(),
      z.null(),
    ])
    .optional(),
});

const createMedicalRecordBody = baseMedicalRecordBody.superRefine((data, ctx) => {
  if (data.thoiGianKetThuc instanceof Date) {
    if (data.thoiGianKetThuc < data.thoiGianVao) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: "Thời gian kết thúc không được nhỏ hơn thời gian vào",
        path: ["thoiGianKetThuc"],
      });
    }
  }
});

const updateMedicalRecordBody = baseMedicalRecordBody
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  })
  .superRefine((data, ctx) => {
    if (data.thoiGianKetThuc instanceof Date && data.thoiGianVao instanceof Date) {
      if (data.thoiGianKetThuc < data.thoiGianVao) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: "Thời gian kết thúc không được nhỏ hơn thời gian vào",
          path: ["thoiGianKetThuc"],
        });
      }
    }
  });

const medicalRecordParam = z.object({
  id: z.coerce
    .number()
    .int("Bệnh án không hợp lệ")
    .min(1, "Bệnh án không hợp lệ"),
});

const getMedicalRecordsQuery = z.object({
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
  status: z.coerce
    .number()
    .int("Trạng thái không hợp lệ")
    .optional(),
  patientId: z.coerce
    .number()
    .int("Bệnh nhân không hợp lệ")
    .min(1, "Bệnh nhân không hợp lệ")
    .optional(),
  departmentId: z.coerce
    .number()
    .int("Khoa không hợp lệ")
    .min(1, "Khoa không hợp lệ")
    .optional(),
});

const medicalRecordByPatientParam = z.object({
  patientId: z.coerce
    .number()
    .int("Bệnh nhân không hợp lệ")
    .min(1, "Bệnh nhân không hợp lệ"),
});

const medicalRecordSchema = {
  createMedicalRecordBody,
  updateMedicalRecordBody,
  medicalRecordParam,
  getMedicalRecordsQuery,
  medicalRecordByPatientParam,
};

export default medicalRecordSchema;
