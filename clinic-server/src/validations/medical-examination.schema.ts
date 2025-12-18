import { z, ZodIssueCode } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Medical examination code is required")
  .max(30, "Medical examination code must not exceed 30 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Medical examination code may only contain letters, numbers, hyphens, and underscores",
  );

const optionalLargeText = (field: string) =>
  z
    .union([
      z
        .string()
        .trim()
        .max(5000, `${field} must not exceed 5000 characters`),
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
        .int(`${field} must be an integer`)
        .min(0, `${field} is invalid`)
        .max(max, `${field} is invalid`),
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
        .min(min, `${field} is invalid`)
        .max(max, `${field} is invalid`),
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
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid"),
  thoiGianKham: z.coerce.date(),
  quaTrinhBenhLy: optionalLargeText("Disease course"),
  tienSuBanThan: optionalLargeText("Personal medical history"),
  tienSuGiaDinh: optionalLargeText("Family medical history"),
  khamToanThan: optionalLargeText("General examination"),
  khamBoPhan: optionalLargeText("Focused examination"),
  mach: optionalInt("Pulse", 300),
  nhietDo: optionalFloat("Temperature", 30, 45),
  nhipTho: optionalInt("Respiratory rate", 200),
  canNang: optionalFloat("Weight", 0, 500),
  chieuCao: optionalFloat("Height", 0, 300),
  huyetApTThu: optionalInt("Systolic blood pressure", 400),
  huyetApTTr: optionalInt("Diastolic blood pressure", 300),
  bmi: optionalFloat("BMI", 0, 150),
  chanDoanBanDau: optionalLargeText("Initial diagnosis"),
  phuongPhapDieuTri: optionalLargeText("Treatment plan"),
  xuTri: optionalLargeText("Management"),
});

const createMedicalExaminationBody = baseMedicalExaminationBody;

const updateMedicalExaminationBody = baseMedicalExaminationBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const medicalExaminationParam = z.object({
  id: z.coerce
    .number()
    .int("Medical examination is invalid")
    .min(1, "Medical examination is invalid"),
});

const medicalExaminationByMedicalRecordParam = z.object({
  medicalRecordId: z.coerce
    .number()
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid"),
});

const updateDiagnosisBody = z
  .object({
    diagnoses: z
      .array(
        z.object({
          benhId: z.coerce
            .number()
            .int("Disease is invalid")
            .min(1, "Disease is invalid"),
          benhChinh: z.boolean(),
        }),
      )
      .max(50, "Diagnosis list must not exceed 50 entries"),
  })
  .superRefine((data, ctx) => {
    const { diagnoses } = data;

    const seen = new Set<number>();
    diagnoses.forEach((diag, index) => {
      if (seen.has(diag.benhId)) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: "Disease is duplicated in the list",
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
        message: "Only one primary disease may be selected",
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
