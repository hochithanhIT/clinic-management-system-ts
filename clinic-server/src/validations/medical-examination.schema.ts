import { z, ZodIssueCode } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Mã phiếu khám không được để trống")
  .max(30, "Mã phiếu khám không được vượt quá 30 ký tự")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Mã phiếu khám chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới",
  );

const optionalLargeText = (field: string) =>
  z
    .union([
      z
        .string()
        .trim()
        .max(5000, `${field} không được vượt quá 5000 ký tự`),
      z.null(),
    ])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      return value.length > 0 ? value : undefined;
    });

const optionalInt = (field: string, max: number) =>
  z
    .union([
      z
        .coerce
        .number()
        .int(`${field} phải là số nguyên`)
        .min(0, `${field} không hợp lệ`)
        .max(max, `${field} không hợp lệ`),
      z.null(),
    ])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      return value;
    });

const optionalFloat = (field: string, min: number, max: number) =>
  z
    .union([
      z
        .coerce
        .number()
        .min(min, `${field} không hợp lệ`)
        .max(max, `${field} không hợp lệ`),
      z.null(),
    ])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      return value;
    });

const baseMedicalExaminationBody = z.object({
  maPhieu: codeSchema.optional(),
  benhAnId: z.coerce
    .number()
    .int("Bệnh án không hợp lệ")
    .min(1, "Bệnh án không hợp lệ"),
  thoiGianKham: z.coerce.date(),
  quaTrinhBenhLy: optionalLargeText("Quá trình bệnh lý"),
  tienSuBanThan: optionalLargeText("Tiền sử bản thân"),
  tienSuGiaDinh: optionalLargeText("Tiền sử gia đình"),
  khamToanThan: optionalLargeText("Khám toàn thân"),
  khamBoPhan: optionalLargeText("Khám bộ phận"),
  mach: optionalInt("Mạch", 300),
  nhietDo: optionalFloat("Nhiệt độ", 30, 45),
  nhipTho: optionalInt("Nhịp thở", 200),
  canNang: optionalFloat("Cân nặng", 0, 500),
  chieuCao: optionalFloat("Chiều cao", 0, 300),
  huyetApTThu: optionalInt("Huyết áp tâm thu", 400),
  huyetApTTr: optionalInt("Huyết áp tâm trương", 300),
  bmi: optionalFloat("BMI", 0, 150),
  chanDoanBanDau: optionalLargeText("Chẩn đoán ban đầu"),
  phuongPhapDieuTri: optionalLargeText("Phương pháp điều trị"),
  xuTri: optionalLargeText("Xử trí"),
});

const createMedicalExaminationBody = baseMedicalExaminationBody;

const updateMedicalExaminationBody = baseMedicalExaminationBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const medicalExaminationParam = z.object({
  id: z.coerce
    .number()
    .int("Phiếu khám bệnh không hợp lệ")
    .min(1, "Phiếu khám bệnh không hợp lệ"),
});

const medicalExaminationByMedicalRecordParam = z.object({
  medicalRecordId: z.coerce
    .number()
    .int("Bệnh án không hợp lệ")
    .min(1, "Bệnh án không hợp lệ"),
});

const updateDiagnosisBody = z
  .object({
    diagnoses: z
      .array(
        z.object({
          benhId: z.coerce
            .number()
            .int("Bệnh không hợp lệ")
            .min(1, "Bệnh không hợp lệ"),
          benhChinh: z.boolean(),
        }),
      )
      .max(50, "Danh sách chẩn đoán không được vượt quá 50 mục"),
  })
  .superRefine((data, ctx) => {
    const { diagnoses } = data;

    const seen = new Set<number>();
    diagnoses.forEach((diag, index) => {
      if (seen.has(diag.benhId)) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: "Bệnh bị trùng lặp trong danh sách",
          path: ["diagnoses", index, "benhId"],
        });
      } else {
        seen.add(diag.benhId);
      }
    });

    const primaryCount = diagnoses.filter((diag) => diag.benhChinh).length;
    if (primaryCount > 1) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: "Chỉ được chọn một bệnh chính",
        path: ["diagnoses"],
      });
    }
  });

const medicalExaminationSchema = {
  createMedicalExaminationBody,
  updateMedicalExaminationBody,
  medicalExaminationParam,
  medicalExaminationByMedicalRecordParam,
  updateDiagnosisBody,
};

export default medicalExaminationSchema;
