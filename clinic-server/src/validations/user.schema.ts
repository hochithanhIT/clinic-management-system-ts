import { z } from "zod";

const getUsersQuery = z.object({
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
  departmentId: z.coerce
    .number()
    .int("Khoa không hợp lệ")
    .min(1, "Khoa không hợp lệ")
    .optional(),
  roleId: z.coerce
    .number()
    .int("Vai trò không hợp lệ")
    .min(1, "Vai trò không hợp lệ")
    .optional(),
});

const getUserParam = z.object({
  id: z.coerce
    .number()
    .int("ID phải là số nguyên")
    .min(1, "ID phải lớn hơn hoặc bằng 1"),
});

const baseUserBody = {
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
    .regex(/^\d{9,15}$/, "Số điện thoại phải bao gồm từ 9 đến 15 chữ số"),
  soChungChiHanhNghe: z
    .string()
    .trim()
    .max(50, "Số chứng chỉ không được vượt quá 50 ký tự")
    .optional(),
  ngayCapChungChi: z.coerce.date().optional(),
  ngayHetHanChungChi: z.coerce.date().optional(),
  daXoa: z.coerce.boolean().optional(),
  khoaId: z.coerce
    .number()
    .int("Khoa không hợp lệ")
    .min(1, "Khoa không hợp lệ"),
  chucDanhId: z.coerce
    .number()
    .int("Chức danh không hợp lệ")
    .min(1, "Chức danh không hợp lệ")
    .optional(),
  chucVuId: z.coerce
    .number()
    .int("Chức vụ không hợp lệ")
    .min(1, "Chức vụ không hợp lệ")
    .optional(),
  vaiTroId: z.coerce
    .number()
    .int("Vai trò không hợp lệ")
    .min(1, "Vai trò không hợp lệ"),
};

const createUserBody = z.object(baseUserBody);

const updateUserBody = z
  .object({
    maNV: z
      .string()
      .trim()
      .min(1, "Mã nhân viên không được để trống")
      .max(30, "Mã nhân viên không được vượt quá 30 ký tự")
      .regex(/^[A-Za-z0-9_-]+$/, "Mã nhân viên chỉ được chứa chữ, số, gạch ngang và gạch dưới"),
    ...baseUserBody,
  })
  .partial()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: "Không có dữ liệu cập nhật",
      path: ["global"],
    }
  );

const userSchema = {
  getUsersQuery,
  getUserParam,
  createUserBody,
  updateUserBody,
};

export default userSchema;
