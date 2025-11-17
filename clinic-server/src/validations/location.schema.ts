import { z } from "zod";

const basePagination = {
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
};

const getCitiesQuery = z.object(basePagination);

const getProvincesQuery = z
  .object({
    ...basePagination,
    cityId: z.coerce
      .number()
      .int("Tỉnh/thành phố không hợp lệ")
      .min(1, "Tỉnh/thành phố không hợp lệ")
      .optional(),
    provinceId: z.coerce
      .number()
      .int("Tỉnh/thành phố không hợp lệ")
      .min(1, "Tỉnh/thành phố không hợp lệ")
      .optional(),
  })
  .transform(({ cityId, provinceId, ...rest }) => ({
    ...rest,
    cityId: cityId ?? provinceId,
  }));

const addCityBody = z.object({
  maTinhTP: z
    .string()
    .trim()
    .min(1, "Mã tỉnh/thành phố không được để trống")
    .max(20, "Mã tỉnh/thành phố không được vượt quá 20 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã tỉnh/thành phố chỉ được chứa chữ, số, gạch ngang và gạch dưới")
    .transform((value) => value.toUpperCase()),
  tenTinhTP: z
    .string()
    .trim()
    .min(1, "Tên tỉnh/thành phố không được để trống")
    .max(100, "Tên tỉnh/thành phố không được vượt quá 100 ký tự"),
});

const addProvinceBody = z.object({
  maXaPhuong: z
    .string()
    .trim()
    .min(1, "Mã xã/phường không được để trống")
    .max(20, "Mã xã/phường không được vượt quá 20 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã xã/phường chỉ được chứa chữ, số, gạch ngang và gạch dưới")
    .transform((value) => value.toUpperCase()),
  tenXaPhuong: z
    .string()
    .trim()
    .min(1, "Tên xã/phường không được để trống")
    .max(100, "Tên xã/phường không được vượt quá 100 ký tự"),
  tinhTPId: z.coerce
    .number()
    .int("Tỉnh/thành phố không hợp lệ")
    .min(1, "Tỉnh/thành phố không hợp lệ"),
});

const provinceParam = z.object({
  id: z.coerce
    .number()
    .int("Xã/phường không hợp lệ")
    .min(1, "Xã/phường không hợp lệ"),
});

const cityParam = z.object({
  id: z.coerce
    .number()
    .int("Tỉnh/thành phố không hợp lệ")
    .min(1, "Tỉnh/thành phố không hợp lệ"),
});

const updateCityBody = addCityBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const updateProvinceBody = addProvinceBody
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Không có dữ liệu cập nhật",
    path: ["global"],
  });

const locationSchema = {
  getCitiesQuery,
  getProvincesQuery,
  addCityBody,
  addProvinceBody,
  updateProvinceBody,
  updateCityBody,
  provinceParam,
  cityParam,
};

export default locationSchema;
