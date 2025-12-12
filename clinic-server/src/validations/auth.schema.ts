import { z } from "zod";

// const passwordSchema = z.string()
//     .min(8, "Password must be at least 8 characters long")
//     .regex(/[A-Z]/, "Password must include at least one uppercase letter")
//     .regex(/[a-z]/, "Password must include at least one lowercase letter")
//     .regex(/[0-9]/, "Password must include at least one number")
//     .regex(/[@$!%*?&]/, "Password must include at least one special character");

const usernameSchema = z.string()
    .trim()
    .min(1, "Username is required");

const login = z.object({
    tenDangNhap: z.string().trim().min(1, "Username is required"),
    matKhau: z.string().min(1, "Password is required")
});

const createAccount = z.object({
    nhanVienId: z.number().min(1, "Employee ID is required"),
    tenDangNhap: usernameSchema,
})

const resetPassword = z.object({
    nhanVienId: z.number().min(1, "Employee ID is required"),
})

const updateAccountStatus = z.object({
    nhanVienId: z.number().min(1, "Employee ID is required"),
    isActive: z.boolean(),
})

// const createAccount = z.object({
//     username: usernameSchema,
//     email: z.string().email("Invalid email format"),
//     password: passwordSchema,

const passwordSchema = z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[@$!%*?&]/, "Password must include at least one special character");

const changePassword = z
    .object({
        currentPassword: passwordSchema,
        newPassword: passwordSchema,
        confirmPassword: passwordSchema,
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Mật khẩu xác nhận không khớp",
        path: ["confirmPassword"],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
        message: "Mật khẩu mới phải khác mật khẩu hiện tại",
        path: ["newPassword"],
    });
//     password_confirmation: z.string().min(1, "Password confirmation is required")
// }).refine((data) => data.password === data.password_confirmation, {
//     path: ["password_confirmation"],
//     message: "Passwords do not match"
// });

const authSchema = {
    login,
    createAccount,
    changePassword,
    resetPassword,
    updateAccountStatus,
};

export default authSchema;