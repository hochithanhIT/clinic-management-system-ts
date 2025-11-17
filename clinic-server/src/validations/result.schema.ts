import { z, ZodIssueCode } from "zod";

const baseResultBody = z.object({
  ctpcdId: z.coerce
    .number()
    .int("Chi tiết phiếu chỉ định không hợp lệ")
    .min(1, "Chi tiết phiếu chỉ định không hợp lệ"),
  tgTiepNhan: z.coerce.date(),
  tgThucHien: z.coerce.date(),
  tgTraKQ: z.coerce.date(),
  ketQua: z
    .string()
    .trim()
    .min(1, "Kết quả không được để trống"),
  ketLuan: z
    .string()
    .trim()
    .min(1, "Kết luận không được để trống"),
  ghiChu: z
    .string()
    .trim()
    .max(1000, "Ghi chú không được vượt quá 1000 ký tự")
    .optional(),
  url: z
    .string()
    .trim()
    .max(255, "URL không được vượt quá 255 ký tự")
    .optional(),
}).superRefine((data, ctx) => {
  if (data.tgThucHien < data.tgTiepNhan) {
    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: "Thời gian thực hiện không được nhỏ hơn thời gian tiếp nhận",
      path: ["tgThucHien"],
    });
  }

  if (data.tgTraKQ < data.tgThucHien) {
    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: "Thời gian trả kết quả không được nhỏ hơn thời gian thực hiện",
      path: ["tgTraKQ"],
    });
  }
});

const addResultBody = baseResultBody;

const updateResultBody = baseResultBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  })
  .superRefine((data, ctx) => {
    const hasReceive = data.tgTiepNhan instanceof Date;
    const hasPerform = data.tgThucHien instanceof Date;
    const hasDeliver = data.tgTraKQ instanceof Date;

    if (hasPerform && hasReceive && data.tgThucHien! < data.tgTiepNhan!) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: "Thời gian thực hiện không được nhỏ hơn thời gian tiếp nhận",
        path: ["tgThucHien"],
      });
    }

    if (hasDeliver) {
      const compareBase = hasPerform ? data.tgThucHien! : data.tgTiepNhan!;
      if (data.tgTraKQ! < compareBase) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: "Thời gian trả kết quả không được nhỏ hơn thời gian thực hiện",
          path: ["tgTraKQ"],
        });
      }
    }
  });

const resultParam = z.object({
  id: z.coerce
    .number()
    .int("Phiếu trả kết quả không hợp lệ")
    .min(1, "Phiếu trả kết quả không hợp lệ"),
});

const resultDetailParam = z.object({
  id: z.coerce
    .number()
    .int("Kết quả chi tiết không hợp lệ")
    .min(1, "Kết quả chi tiết không hợp lệ"),
});

const addResultDetailBody = z.object({
  ketQuaId: z.coerce
    .number()
    .int("Phiếu trả kết quả không hợp lệ")
    .min(1, "Phiếu trả kết quả không hợp lệ"),
  chiSo: z
    .string()
    .trim()
    .min(1, "Chỉ số không được để trống")
    .max(255, "Chỉ số không được vượt quá 255 ký tự"),
  giaTri: z
    .string()
    .trim()
    .min(1, "Giá trị không được để trống")
    .max(255, "Giá trị không được vượt quá 255 ký tự"),
  batThuong: z.coerce.boolean("Trạng thái bất thường không hợp lệ"),
});

const updateResultDetailBody = addResultDetailBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const getResultsQuery = z.object({
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
  serviceOrderId: z.coerce
    .number()
    .int("Phiếu chỉ định không hợp lệ")
    .min(1, "Phiếu chỉ định không hợp lệ")
    .optional(),
  ctpcdId: z.coerce
    .number()
    .int("Chi tiết phiếu chỉ định không hợp lệ")
    .min(1, "Chi tiết phiếu chỉ định không hợp lệ")
    .optional(),
  medicalRecordId: z.coerce
    .number()
    .int("Bệnh án không hợp lệ")
    .min(1, "Bệnh án không hợp lệ")
    .optional(),
  serviceId: z.coerce
    .number()
    .int("Dịch vụ không hợp lệ")
    .min(1, "Dịch vụ không hợp lệ")
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
