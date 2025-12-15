import { z } from "zod";

const getAppointmentsQuery = z.object({
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
  benhNhanId: z.coerce
    .number()
    .int("Bệnh nhân không hợp lệ")
    .min(1, "Bệnh nhân không hợp lệ")
    .optional(),
  phongId: z.coerce
    .number()
    .int("Phòng không hợp lệ")
    .min(1, "Phòng không hợp lệ")
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  (value) => {
    if (value.from && value.to) {
      return value.from <= value.to;
    }

    return true;
  },
  {
    message: "Khoảng thời gian không hợp lệ",
    path: ["from"],
  },
);

const appointmentParam = z.object({
  id: z.coerce
    .number()
    .int("Hẹn khám không hợp lệ")
    .min(1, "Hẹn khám không hợp lệ"),
});

const notesField = z
  .union([
    z
      .string()
      .trim()
      .max(2000, "Ghi chú không được vượt quá 2000 ký tự"),
    z.null(),
  ])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const baseAppointmentBody = z.object({
  scheduledAt: z.coerce.date(),
  reason: z
    .string()
    .trim()
    .min(1, "Lý do hẹn khám không được để trống")
    .max(255, "Lý do hẹn khám không được vượt quá 255 ký tự"),
  notes: notesField,
  phongId: z.coerce
    .number()
    .int("Phòng không hợp lệ")
    .min(1, "Phòng không hợp lệ"),
});

const createAppointmentBody = baseAppointmentBody.extend({
  benhNhanId: z.coerce
    .number()
    .int("Bệnh nhân không hợp lệ")
    .min(1, "Bệnh nhân không hợp lệ"),
});

const updateAppointmentBody = baseAppointmentBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const appointmentSchema = {
  getAppointmentsQuery,
  appointmentParam,
  createAppointmentBody,
  updateAppointmentBody,
};

export default appointmentSchema;
