import { z } from "zod";

const getServicesQuery = z.object({
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
    .default(10),
  search: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm không được vượt quá 100 ký tự")
    .optional()
    .transform((value) => (value ? value : undefined)),
  nhomDichVuId: z.coerce
    .number()
    .int("Nhóm dịch vụ không hợp lệ")
    .min(1, "Nhóm dịch vụ không hợp lệ")
    .optional(),
  loaiDichVuId: z.coerce
    .number()
    .int("Loại dịch vụ không hợp lệ")
    .min(1, "Loại dịch vụ không hợp lệ")
    .optional(),
});

const serviceParam = z.object({
  id: z.coerce
    .number()
    .int("Dịch vụ không hợp lệ")
    .min(1, "Dịch vụ không hợp lệ"),
});

const addServiceBody = z.object({
  maDV: z
    .string()
    .trim()
    .min(1, "Mã dịch vụ không được để trống")
    .max(30, "Mã dịch vụ không được vượt quá 30 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã dịch vụ chỉ được chứa chữ, số, gạch ngang và gạch dưới")
    .transform((value) => value.toUpperCase()),
  tenDV: z
    .string()
    .trim()
    .min(1, "Tên dịch vụ không được để trống")
    .max(200, "Tên dịch vụ không được vượt quá 200 ký tự"),
  donVi: z
    .string()
    .trim()
    .max(50, "Đơn vị không được vượt quá 50 ký tự")
    .optional(),
  donGia: z.coerce
    .number()
    .min(0, "Đơn giá không được âm"),
  thamChieuMin: z
    .string()
    .trim()
    .max(100, "Giá trị tham chiếu không được vượt quá 100 ký tự")
    .optional(),
  thamChieuMax: z
    .string()
    .trim()
    .max(100, "Giá trị tham chiếu không được vượt quá 100 ký tự")
    .optional(),
  nhomDichVuId: z.coerce
    .number()
    .int("Nhóm dịch vụ không hợp lệ")
    .min(1, "Nhóm dịch vụ không hợp lệ"),
  phongThucHienId: z
    .union([
      z.coerce
        .number()
        .int("Phòng thực hiện không hợp lệ")
        .min(1, "Phòng thực hiện không hợp lệ"),
      z.null(),
    ])
    .optional(),
});

const updateServiceBody = addServiceBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const serviceSchema = {
  getServicesQuery,
  serviceParam,
  addServiceBody,
  updateServiceBody,
};

export default serviceSchema;
