import { z } from "zod";

const invoiceCodeSchema = z
  .string()
  .trim()
  .min(1, "Mã hóa đơn không được để trống")
  .max(30, "Mã hóa đơn không được vượt quá 30 ký tự")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Mã hóa đơn chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới",
  )
  .transform((value) => value.toUpperCase());

const baseInvoiceBody = z.object({
  maHD: invoiceCodeSchema,
  benhAnId: z.coerce
    .number()
    .int("Bệnh án không hợp lệ")
    .min(1, "Bệnh án không hợp lệ"),
  nhanVienId: z.coerce
    .number()
    .int("Nhân viên không hợp lệ")
    .min(1, "Nhân viên không hợp lệ"),
  ngayLap: z.coerce.date(),
  tongTien: z.coerce
    .number()
    .min(0, "Tổng tiền không được âm"),
  trangThai: z.coerce
    .number()
    .int("Trạng thái không hợp lệ"),
});

const addInvoiceBody = baseInvoiceBody;

const updateInvoiceBody = baseInvoiceBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const invoiceParam = z.object({
  id: z.coerce
    .number()
    .int("Hóa đơn không hợp lệ")
    .min(1, "Hóa đơn không hợp lệ"),
});

const invoiceDetailParam = z.object({
  id: z.coerce
    .number()
    .int("Chi tiết hóa đơn không hợp lệ")
    .min(1, "Chi tiết hóa đơn không hợp lệ"),
});

const baseInvoiceDetailBody = z.object({
  hoaDonId: z.coerce
    .number()
    .int("Hóa đơn không hợp lệ")
    .min(1, "Hóa đơn không hợp lệ"),
  ctpcdId: z.coerce
    .number()
    .int("Chi tiết phiếu chỉ định không hợp lệ")
    .min(1, "Chi tiết phiếu chỉ định không hợp lệ"),
  soLuong: z.coerce
    .number()
    .int("Số lượng phải là số nguyên")
    .min(1, "Số lượng phải lớn hơn 0"),
  thanhTien: z.coerce
    .number()
    .min(0, "Thành tiền không được âm"),
});

const addInvoiceDetailBody = baseInvoiceDetailBody;

const updateInvoiceDetailBody = baseInvoiceDetailBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const invoiceSchema = {
  addInvoiceBody,
  updateInvoiceBody,
  invoiceParam,
  addInvoiceDetailBody,
  updateInvoiceDetailBody,
  invoiceDetailParam,
};

export default invoiceSchema;
