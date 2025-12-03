import { z } from "zod";

const orderCodeSchema = z
  .string()
  .trim()
  .min(1, "Mã phiếu chỉ định không được để trống")
  .max(30, "Mã phiếu chỉ định không được vượt quá 30 ký tự")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Mã phiếu chỉ định chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới",
  )
  .transform((value) => value.toUpperCase());

const baseServiceOrderBody = z.object({
  maPhieuCD: orderCodeSchema,
  benhAnId: z.coerce
    .number()
    .int("Bệnh án không hợp lệ")
    .min(1, "Bệnh án không hợp lệ"),
  thoiGianTao: z.coerce.date(),
  trangThai: z.coerce
    .number()
    .int("Trạng thái không hợp lệ"),
  nvChiDinhId: z
    .union([
      z.coerce
        .number()
        .int("Nhân viên chỉ định không hợp lệ")
        .min(1, "Nhân viên chỉ định không hợp lệ"),
      z.null(),
    ])
    .optional(),
});

const addServiceOrderBody = baseServiceOrderBody;

const updateServiceOrderBody = baseServiceOrderBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const serviceOrderParam = z.object({
  id: z.coerce
    .number()
    .int("Phiếu chỉ định không hợp lệ")
    .min(1, "Phiếu chỉ định không hợp lệ"),
});

const getServiceOrdersQuery = z.object({
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
  medicalRecordId: z.coerce
    .number()
    .int("Bệnh án không hợp lệ")
    .min(1, "Bệnh án không hợp lệ")
    .optional(),
});

const serviceOrderDetailParam = z.object({
  id: z.coerce
    .number()
    .int("Chi tiết phiếu chỉ định không hợp lệ")
    .min(1, "Chi tiết phiếu chỉ định không hợp lệ"),
});

const serviceOrderDetailsByOrderParam = z.object({
  serviceOrderId: z.coerce
    .number()
    .int("Phiếu chỉ định không hợp lệ")
    .min(1, "Phiếu chỉ định không hợp lệ"),
});

const baseServiceOrderDetailBody = z.object({
  phieuChiDinhId: z.coerce
    .number()
    .int("Phiếu chỉ định không hợp lệ")
    .min(1, "Phiếu chỉ định không hợp lệ"),
  dichVuId: z.coerce
    .number()
    .int("Dịch vụ không hợp lệ")
    .min(1, "Dịch vụ không hợp lệ"),
  soLuong: z.coerce
    .number()
    .int("Số lượng phải là số nguyên")
    .min(1, "Số lượng phải lớn hơn 0"),
  tongTien: z.coerce
    .number()
    .min(0, "Tổng tiền không được âm"),
  yeuCauKQ: z.coerce
    .boolean("Yêu cầu kết quả không hợp lệ"),
  trangThaiDongTien: z.coerce
    .boolean("Trạng thái đóng tiền không hợp lệ"),
});

const addServiceOrderDetailBody = baseServiceOrderDetailBody;

const updateServiceOrderDetailBody = baseServiceOrderDetailBody
  .partial()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
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
