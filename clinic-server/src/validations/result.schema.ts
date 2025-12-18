import { z, ZodIssueCode } from "zod";

const baseResultBody = z.object({
  ctpcdId: z.coerce
    .number()
    .int("Service order detail is invalid")
    .min(1, "Service order detail is invalid"),
  tgTiepNhan: z.coerce.date(),
  tgThucHien: z.coerce.date(),
  tgTraKQ: z.coerce.date(),
  ketQua: z
    .string()
    .trim()
    .min(1, "Result is required"),
  ketLuan: z
    .string()
    .trim()
    .min(1, "Conclusion is required"),
  ghiChu: z
    .string()
    .trim()
    .max(1000, "Notes must not exceed 1000 characters")
    .optional(),
  url: z
    .string()
    .trim()
    .max(255, "URL must not exceed 255 characters")
    .optional(),
}).superRefine((data, ctx) => {
  if (data.tgThucHien < data.tgTiepNhan) {
    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: "Perform time cannot be earlier than receive time",
      path: ["tgThucHien"],
    });
  }

  if (data.tgTraKQ < data.tgThucHien) {
    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: "Result delivery time cannot be earlier than perform time",
      path: ["tgTraKQ"],
    });
  }
});

const addResultBody = baseResultBody;

const updateResultBody = baseResultBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  })
  .superRefine((data, ctx) => {
    const hasReceive = data.tgTiepNhan instanceof Date;
    const hasPerform = data.tgThucHien instanceof Date;
    const hasDeliver = data.tgTraKQ instanceof Date;

    if (hasPerform && hasReceive && data.tgThucHien! < data.tgTiepNhan!) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: "Perform time cannot be earlier than receive time",
        path: ["tgThucHien"],
      });
    }

    if (hasDeliver) {
      const compareBase = hasPerform ? data.tgThucHien! : data.tgTiepNhan!;
      if (data.tgTraKQ! < compareBase) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: "Result delivery time cannot be earlier than perform time",
          path: ["tgTraKQ"],
        });
      }
    }
  });

const resultParam = z.object({
  id: z.coerce
    .number()
    .int("Result form is invalid")
    .min(1, "Result form is invalid"),
});

const resultDetailParam = z.object({
  id: z.coerce
    .number()
    .int("Result detail is invalid")
    .min(1, "Result detail is invalid"),
});

const addResultDetailBody = z.object({
  ketQuaId: z.coerce
    .number()
    .int("Result form is invalid")
    .min(1, "Result form is invalid"),
  chiSo: z
    .string()
    .trim()
    .min(1, "Indicator is required")
    .max(255, "Indicator must not exceed 255 characters"),
  giaTri: z
    .string()
    .trim()
    .min(1, "Value is required")
    .max(255, "Value must not exceed 255 characters"),
  batThuong: z.coerce.boolean("Abnormal status is invalid"),
});

const updateResultDetailBody = addResultDetailBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const getResultsQuery = z.object({
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
  serviceOrderId: z.coerce
    .number()
    .int("Service order is invalid")
    .min(1, "Service order is invalid")
    .optional(),
  ctpcdId: z.coerce
    .number()
    .int("Service order detail is invalid")
    .min(1, "Service order detail is invalid")
    .optional(),
  medicalRecordId: z.coerce
    .number()
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid")
    .optional(),
  serviceId: z.coerce
    .number()
    .int("Service is invalid")
    .min(1, "Service is invalid")
    .optional(),
});

const resultSchema = {
  addResultBody,
  updateResultBody,
  resultParam,
  addResultDetailBody,
  updateResultDetailBody,
  resultDetailParam,
  getResultsQuery,
};

export default resultSchema;
