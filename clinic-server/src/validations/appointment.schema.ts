import { z } from "zod";

const getAppointmentsQuery = z.object({
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
  benhNhanId: z.coerce
    .number()
    .int("Patient is invalid")
    .min(1, "Patient is invalid")
    .optional(),
  phongId: z.coerce
    .number()
    .int("Room is invalid")
    .min(1, "Room is invalid")
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
    message: "Invalid time range",
    path: ["from"],
  },
);

const appointmentParam = z.object({
  id: z.coerce
    .number()
    .int("Appointment is invalid")
    .min(1, "Appointment is invalid"),
});

const notesField = z
  .union([
    z
      .string()
      .trim()
      .max(2000, "Notes must not exceed 2000 characters"),
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
    .min(1, "Appointment reason is required")
    .max(255, "Appointment reason must not exceed 255 characters"),
  notes: notesField,
  phongId: z.coerce
    .number()
    .int("Room is invalid")
    .min(1, "Room is invalid"),
});

const createAppointmentBody = baseAppointmentBody.extend({
  benhNhanId: z.coerce
    .number()
    .int("Patient is invalid")
    .min(1, "Patient is invalid"),
});

const updateAppointmentBody = baseAppointmentBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No data to update",
    path: ["global"],
  });

const appointmentSchema = {
  getAppointmentsQuery,
  appointmentParam,
  createAppointmentBody,
  updateAppointmentBody,
};

export default appointmentSchema;
