import { z } from "zod";

const phoneRegex = /^\d{9,15}$/;
const cccdRegex = /^\d{9,12}$/;

const addNewPatient = z.object({
  maBenhNhan: z
    .string()
    .trim()
    .min(1, "Mã bệnh nhân không được để trống")
    .max(30, "Mã bệnh nhân không được vượt quá 30 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã bệnh nhân chỉ được chứa chữ cái, số, dấu gạch ngang và gạch dưới")
    .optional(),
  hoTen: z
    .string()
    .trim()
    .min(1, "Họ tên không được để trống")
    .max(100, "Họ tên không được vượt quá 100 ký tự"),
  ngaySinh: z.coerce
    .date()
    .max(new Date(), "Ngày sinh không được vượt quá ngày hiện tại"),
  gioiTinh: z.coerce
    .number()
    .int("Giới tính phải là số nguyên")
    .refine((value) => [0, 1].includes(value), "Giới tính không hợp lệ"),
  sdt: z
    .string()
    .trim()
    .regex(phoneRegex, "Số điện thoại phải bao gồm từ 9 đến 15 chữ số")
    .optional(),
  cccd: z
    .string()
    .trim()
    .regex(cccdRegex, "CCCD phải bao gồm từ 9 đến 12 chữ số")
    .optional(),
  hoTenNguoiNha: z
    .string()
    .trim()
    .min(1, "Họ tên người nhà không được để trống")
    .max(100, "Họ tên người nhà không được vượt quá 100 ký tự")
    .optional(),
  sdtNguoiNha: z
    .string()
    .trim()
    .regex(phoneRegex, "Số điện thoại người nhà phải bao gồm từ 9 đến 15 chữ số")
    .optional(),
  quanHe: z
    .string()
    .trim()
    .min(1, "Quan hệ với bệnh nhân không được để trống")
    .max(50, "Quan hệ với bệnh nhân không được vượt quá 50 ký tự")
    .optional(),
  ngheNghiepId: z.coerce
    .number()
    .int("Nghề nghiệp không hợp lệ")
    .min(1, "Nghề nghiệp không hợp lệ"),
  xaPhuongId: z.coerce
    .number()
    .int("Xã phường không hợp lệ")
    .min(1, "Xã phường không hợp lệ"),
});

const getPatientsQuery = z.object({
  page: z.coerce
    .number()
    .int("Trang phải là số nguyên")
    .min(1, "Trang phải lớn hơn hoặc bằng 1")
    .max(1000, "Trang không được vượt quá 1000")
    .default(1),
  limit: z.coerce
    .number()
    .int("Giới hạn phải là số nguyên")
    .min(1, "Giới hạn phải lớn hơn hoặc bằng 1")
    .max(100, "Giới hạn không được vượt quá 100")
    .default(10),
  search: z
    .string()
    .trim()
    .max(100, "Từ khóa tìm kiếm không được vượt quá 100 ký tự")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

const getPatientParam = z.object({
  id: z.coerce
    .number()
    .int("ID phải là số nguyên")
    .min(1, "ID phải lớn hơn hoặc bằng 1"),
});

const updatePatientBody = z
  .object({
    maBenhNhan: addNewPatient.shape.maBenhNhan,
    hoTen: addNewPatient.shape.hoTen.optional(),
    ngaySinh: addNewPatient.shape.ngaySinh.optional(),
    gioiTinh: addNewPatient.shape.gioiTinh.optional(),
    sdt: addNewPatient.shape.sdt,
    cccd: addNewPatient.shape.cccd,
    hoTenNguoiNha: addNewPatient.shape.hoTenNguoiNha,
    sdtNguoiNha: addNewPatient.shape.sdtNguoiNha,
    quanHe: addNewPatient.shape.quanHe,
    ngheNghiepId: addNewPatient.shape.ngheNghiepId.optional(),
    xaPhuongId: addNewPatient.shape.xaPhuongId.optional(),
  })
  .partial()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: "Không có dữ liệu cập nhật",
      path: ["global"],
    }
  );

const patientSchema = {
  addNewPatient,
  getPatientsQuery,
  getPatientParam,
  updatePatientBody,
};

export default patientSchema;
