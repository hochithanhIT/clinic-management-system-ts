import { z } from "zod";

const orderCodeSchema = z
  .string()
  .trim()
  .min(1, "Service order code is required")
  .max(30, "Service order code must not exceed 30 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Service order code may only contain letters, numbers, hyphens, and underscores",
  )
  .transform((value) => value.toUpperCase());

const baseServiceOrderBody = z.object({
  maPhieuCD: orderCodeSchema,
  benhAnId: z.coerce
    .number()
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid"),
  thoiGianTao: z.coerce.date(),
  trangThai: z.coerce
    .number()
    .int("Status is invalid"),
  nvChiDinhId: z
    .union([
      z.coerce
        .number()
        .int("Ordering employee is invalid")
        .min(1, "Ordering employee is invalid"),
      z.null(),
    ])
    .optional(),
});

const addServiceOrderBody = baseServiceOrderBody;

const updateServiceOrderBody = baseServiceOrderBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const serviceOrderParam = z.object({
  id: z.coerce
    .number()
    .int("Service order is invalid")
    .min(1, "Service order is invalid"),
});

const getServiceOrdersQuery = z.object({
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
  medicalRecordId: z.coerce
    .number()
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid")
    .optional(),
});

const serviceOrderDetailParam = z.object({
  id: z.coerce
    .number()
    .int("Service order detail is invalid")
    .min(1, "Service order detail is invalid"),
});

const serviceOrderDetailsByOrderParam = z.object({
  serviceOrderId: z.coerce
    .number()
    .int("Service order is invalid")
    .min(1, "Service order is invalid"),
});

const baseServiceOrderDetailBody = z.object({
  phieuChiDinhId: z.coerce
    .number()
    .int("Service order is invalid")
    .min(1, "Service order is invalid"),
  dichVuId: z.coerce
    .number()
    .int("Service is invalid")
    .min(1, "Service is invalid"),
  soLuong: z.coerce
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be greater than 0"),
  tongTien: z.coerce
    .number()
    .min(0, "Total amount cannot be negative"),
  yeuCauKQ: z.coerce
    .boolean("Result request flag is invalid"),
  trangThaiDongTien: z.coerce
    .boolean("Payment status is invalid"),
});

const addServiceOrderDetailBody = baseServiceOrderDetailBody;

const updateServiceOrderDetailBody = baseServiceOrderDetailBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const serviceOrderSchema = {
  addServiceOrderBody,
  updateServiceOrderBody,
  serviceOrderParam,
  getServiceOrdersQuery,
  addServiceOrderDetailBody,
  updateServiceOrderDetailBody,
  serviceOrderDetailParam,
  serviceOrderDetailsByOrderParam,
};

export default serviceOrderSchema;
