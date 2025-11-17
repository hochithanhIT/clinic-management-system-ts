import { z } from "zod";

const getRoomsQuery = z.object({
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
  khoaId: z.coerce
    .number()
    .int("Khoa không hợp lệ")
    .min(1, "Khoa không hợp lệ")
    .optional(),
});

const roomParam = z.object({
  id: z.coerce
    .number()
    .int("Phòng không hợp lệ")
    .min(1, "Phòng không hợp lệ"),
});

const addRoomBody = z.object({
  tenPhong: z
    .string()
    .trim()
    .min(1, "Tên phòng không được để trống")
    .max(100, "Tên phòng không được vượt quá 100 ký tự"),
  khoaId: z.coerce
    .number()
    .int("Khoa không hợp lệ")
    .min(1, "Khoa không hợp lệ"),
});

const updateRoomBody = addRoomBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const roomSchema = {
  getRoomsQuery,
  roomParam,
  addRoomBody,
  updateRoomBody,
};

export default roomSchema;
