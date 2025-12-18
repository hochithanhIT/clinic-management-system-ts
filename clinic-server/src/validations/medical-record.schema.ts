import { z, ZodIssueCode } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Medical record code is required")
  .max(30, "Medical record code must not exceed 30 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Medical record code may only contain letters, numbers, hyphens, and underscores",
  );

const nullableCoercedDate = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }

  return value;
}, z.date().or(z.null()));

const baseMedicalRecordBody = z.object({
  maBA: codeSchema.optional(),
  benhNhanId: z.coerce
    .number()
    .int("Patient is invalid")
    .min(1, "Patient is invalid"),
  nvTiepNhanId: z.coerce
    .number()
    .int("Intake employee is invalid")
    .min(1, "Intake employee is invalid"),
  nvKhamId: z
    .union([
      z.coerce
        .number()
        .int("Examining employee is invalid")
        .min(1, "Examining employee is invalid"),
      z.null(),
    ])
    .optional(),
  phongId: z
    .union([
      z.coerce
        .number()
        .int("Exam room is invalid")
        .min(1, "Exam room is invalid"),
      z.null(),
    ])
    .optional(),
  thoiGianVao: z.coerce.date(),
  lyDoKhamBenh: z
    .string()
    .trim()
    .min(1, "Visit reason is required")
    .max(500, "Visit reason must not exceed 500 characters"),
  trangThai: z.coerce
    .number()
    .int("Status is invalid")
    .min(0, "Status is invalid")
    .optional(),
  thoiGianKetThuc: nullableCoercedDate.optional(),
});

const createMedicalRecordBody = baseMedicalRecordBody.superRefine((data, ctx) => {
  if (data.thoiGianKetThuc instanceof Date) {
    if (data.thoiGianKetThuc < data.thoiGianVao) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: "End time cannot be earlier than start time",
        path: ["thoiGianKetThuc"],
      });
    }
  }
});

const updateMedicalRecordBody = baseMedicalRecordBody
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "No data to update",
    path: ["global"],
  })
  .superRefine((data, ctx) => {
    if (data.thoiGianKetThuc instanceof Date && data.thoiGianVao instanceof Date) {
      if (data.thoiGianKetThuc < data.thoiGianVao) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: "End time cannot be earlier than start time",
          path: ["thoiGianKetThuc"],
        });
      }
    }
  });

const medicalRecordParam = z.object({
  id: z.coerce
    .number()
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid"),
});

const getMedicalRecordsQuery = z.object({
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
    .default(20),
  search: z
    .string()
    .trim()
    .max(100, "Search term must not exceed 100 characters")
    .optional()
    .transform((value) => (value ? value : undefined)),
  status: z.coerce
    .number()
    .int("Status is invalid")
    .optional(),
  patientId: z.coerce
    .number()
    .int("Patient is invalid")
    .min(1, "Patient is invalid")
    .optional(),
  departmentId: z.coerce
    .number()
    .int("Department is invalid")
    .min(1, "Department is invalid")
    .optional(),
  roomId: z.coerce
    .number()
    .int("Exam room is invalid")
    .min(1, "Exam room is invalid")
    .optional(),
  enteredFrom: z.coerce.date().optional(),
  enteredTo: z.coerce.date().optional(),
})
  .refine(
    (value) => {
      if (value.enteredFrom && value.enteredTo) {
        return value.enteredFrom <= value.enteredTo;
      }

      return true;
    },
    {
      message: "Invalid time range",
      path: ["enteredTo"],
    },
  );

const medicalRecordByPatientParam = z.object({
  patientId: z.coerce
    .number()
    .int("Patient is invalid")
    .min(1, "Patient is invalid"),
});

const medicalRecordSchema = {
  createMedicalRecordBody,
  updateMedicalRecordBody,
  medicalRecordParam,
  getMedicalRecordsQuery,
  medicalRecordByPatientParam,
};

export default medicalRecordSchema;
