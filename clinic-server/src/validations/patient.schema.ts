import { z } from "zod";

const phoneRegex = /^\d{9,15}$/;
const cccdRegex = /^\d{9,12}$/;

const addNewPatient = z.object({
  maBenhNhan: z
    .string()
    .trim()
    .min(1, "Patient code is required")
    .max(30, "Patient code must not exceed 30 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Patient code may only contain letters, numbers, hyphens, and underscores")
    .optional(),
  hoTen: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must not exceed 100 characters"),
  ngaySinh: z.coerce
    .date()
    .max(new Date(), "Date of birth cannot be in the future"),
  gioiTinh: z.coerce
    .number()
    .int("Gender must be an integer")
    .refine((value) => [0, 1].includes(value), "Gender is invalid"),
  sdt: z
    .string()
    .trim()
    .regex(phoneRegex, "Phone number must contain between 9 and 15 digits")
    .optional(),
  cccd: z
    .string()
    .trim()
    .regex(cccdRegex, "National ID must contain between 9 and 12 digits")
    .optional(),
  hoTenNguoiNha: z
    .string()
    .trim()
    .min(1, "Emergency contact name is required")
    .max(100, "Emergency contact name must not exceed 100 characters")
    .optional(),
  sdtNguoiNha: z
    .string()
    .trim()
    .regex(phoneRegex, "Emergency contact phone number must contain between 9 and 15 digits")
    .optional(),
  quanHe: z
    .string()
    .trim()
    .min(1, "Relationship to patient is required")
    .max(50, "Relationship to patient must not exceed 50 characters")
    .optional(),
  ngheNghiepId: z.coerce
    .number()
    .int("Occupation is invalid")
    .min(1, "Occupation is invalid"),
  xaPhuongId: z.coerce
    .number()
    .int("Ward/Commune is invalid")
    .min(1, "Ward/Commune is invalid"),
});

const getPatientsQuery = z.object({
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
});

const getPatientParam = z.object({
  id: z.coerce
    .number()
    .int("ID must be an integer")
    .min(1, "ID must be greater than or equal to 1"),
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
      message: "No data to update",
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
