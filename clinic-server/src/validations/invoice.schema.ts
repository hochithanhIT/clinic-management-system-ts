import { z } from "zod";

const invoiceCodeSchema = z
  .string()
  .trim()
  .min(1, "Invoice code is required")
  .max(30, "Invoice code must not exceed 30 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Invoice code may only contain letters, numbers, hyphens, and underscores",
  )
  .transform((value) => value.toUpperCase());

const baseInvoiceBody = z.object({
  maHD: invoiceCodeSchema,
  benhAnId: z.coerce
    .number()
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid"),
  nhanVienId: z.coerce
    .number()
    .int("Employee is invalid")
    .min(1, "Employee is invalid"),
  ngayLap: z.coerce.date(),
  tongTien: z.coerce
    .number()
    .min(0, "Total amount cannot be negative"),
  trangThai: z.coerce
    .number()
    .int("Status is invalid"),
});

const addInvoiceBody = baseInvoiceBody;

const updateInvoiceBody = baseInvoiceBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const invoiceParam = z.object({
  id: z.coerce
    .number()
    .int("Invoice is invalid")
    .min(1, "Invoice is invalid"),
});

const invoiceDetailParam = z.object({
  id: z.coerce
    .number()
    .int("Invoice detail is invalid")
    .min(1, "Invoice detail is invalid"),
});

const getInvoicesQuery = z.object({
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
    .default(10),
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

const baseInvoiceDetailBody = z.object({
  hoaDonId: z.coerce
    .number()
    .int("Invoice is invalid")
    .min(1, "Invoice is invalid"),
  ctpcdId: z.coerce
    .number()
    .int("Service order detail is invalid")
    .min(1, "Service order detail is invalid"),
  soLuong: z.coerce
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be greater than 0"),
  thanhTien: z.coerce
    .number()
    .min(0, "Line total cannot be negative"),
});

const addInvoiceDetailBody = baseInvoiceDetailBody;

const updateInvoiceDetailBody = baseInvoiceDetailBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const settleInvoiceBody = z.object({
  medicalRecordId: z.coerce
    .number()
    .int("Medical record is invalid")
    .min(1, "Medical record is invalid"),
  employeeId: z.coerce
    .number()
    .int("Employee is invalid")
    .min(1, "Employee is invalid"),
  invoiceDate: z.coerce.date(),
  amountReceived: z.coerce
    .number()
    .min(0, "Amount received must be at least 0"),
  serviceDetailIds: z
    .array(
      z.coerce
        .number()
        .int("Service order detail is invalid")
        .min(1, "Service order detail is invalid"),
    )
    .min(1, "Please select at least one service to settle")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Service order detail list is invalid",
      path: ["serviceDetailIds"],
    }),
});

const invoiceSchema = {
  addInvoiceBody,
  updateInvoiceBody,
  invoiceParam,
  getInvoicesQuery,
  addInvoiceDetailBody,
  updateInvoiceDetailBody,
  invoiceDetailParam,
  settleInvoiceBody,
};

export default invoiceSchema;
