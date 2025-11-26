import Send from "../utils/response.utils";
import { prisma } from "../db";
import { NextFunction, Request, Response } from "express";
import authSchema from "../validations/auth.schema";
import bcrypt from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";

const login = async (req: Request, res: Response) => {
    const { tenDangNhap, matKhau } = req.body as z.infer<typeof authSchema.login>;

    try {
        const user = await prisma.taiKhoan.findUnique({
            where: { tenDangNhap },
            select: {
                tenDangNhap: true,
                matKhau: true,
                nhanVienId: true,
                nhanVien: {
                    select: {
                        hoTen: true,
                    }
                }
            }
        });
        if (!user) {
            return Send.error(res, null, "Invalid username or password.");
        }

        const isPasswordValid = await bcrypt.compare(matKhau, user.matKhau);
        if (!isPasswordValid) {
            return Send.error(res, null, "Invalid username or password.");
        }

        const accessToken = jwt.sign(
            { userId: user.nhanVienId },
            process.env.AUTH_SECRET!,
            { expiresIn: '15m' }
        )

        const refreshToken = jwt.sign(
            { userId: user.nhanVienId },
            process.env.AUTH_REFRESH_SECRET!,
            { expiresIn: '24h' }
        )

        await prisma.taiKhoan.update({
            where: { tenDangNhap },
            data: { refreshToken }
        })

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 15 * 60 * 1000, // 15 minutes
            sameSite: "strict"
        })

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000, // 1 day
            sameSite: "strict"
        })

        return Send.success(res, {
            id: user.nhanVienId,
            tenDangNhap: user.tenDangNhap,
            hoTen: user.nhanVien?.hoTen ?? "",
        })
    } catch (error) {
        console.error("Login failed:", error);
        return Send.error(res, null, "Login failed.");
    }
}

const createAccount = async (req: Request, res: Response) => {
    const { nhanVienId, tenDangNhap } = req.body as z.infer<typeof authSchema.createAccount>;

    try {
        const existingAccount = await prisma.taiKhoan.findUnique({
            where: { nhanVienId }
        })

        if (existingAccount) {
            return Send.error(res, null, "Employee already has an account.");
        }

        const existingUsername = await prisma.taiKhoan.findUnique({
            where: { tenDangNhap }
        })
        if (existingUsername) {
            return Send.error(res, null, "Username already exists.");
        }

        const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD
        if (!DEFAULT_PASSWORD) {
            throw new Error("DEFAULT_PASSWORD is not set in environment variables.");
        }
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        const newAccount = await prisma.taiKhoan.create({
            data: {
                nhanVienId,
                tenDangNhap,
                matKhau: hashedPassword,
            }
        })

        return Send.success(res, {
            id: newAccount.nhanVienId,
            tenDangNhap: newAccount.tenDangNhap,
        }, "Account created successfully.");
    } catch (error) {
        console.error("Account creation failed:", error);
        return Send.error(res, null, "Account creation failed.");
    }

}

const changePassword = async (req: Request, res: Response) => {
    try {
        const nhanVienId: number | undefined = req.body.nhanVienId;
        if (!nhanVienId) {
            return Send.unauthorized(res, null, "Unable to identify user");
        }

        const { currentPassword, newPassword } = authSchema.changePassword.parse(req.body);

        const account = await prisma.taiKhoan.findUnique({
            where: { nhanVienId },
            select: {
                nhanVienId: true,
                tenDangNhap: true,
                matKhau: true,
            },
        });

        if (!account) {
            return Send.notFound(res, null, "User account not found");
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, account.matKhau);
        if (!isCurrentPasswordValid) {
            return Send.badRequest(res, null, "Current password is incorrect");
        }

        const isSamePassword = await bcrypt.compare(newPassword, account.matKhau);
        if (isSamePassword) {
            return Send.badRequest(res, null, "New password must differ from the current password");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.taiKhoan.update({
            where: { nhanVienId: account.nhanVienId },
            data: {
                matKhau: hashedPassword,
                refreshToken: null,
            },
        });

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        return Send.success(res, null, "Password updated successfully, please sign in again");
    } catch (error) {
        if (error instanceof z.ZodError) {
            return Send.validationErrors(res, error.flatten().fieldErrors);
        }

        console.error("Password change failed:", error);
        return Send.error(res, null, "Password change failed");
    }
}

const logout = async (req: Request, res: Response) => {
    try {
        const { nhanVienId }= req.body;
        if (nhanVienId) {
            await prisma.taiKhoan.updateMany({
            where: { nhanVienId },
            data: { refreshToken: null }
            });
        }

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        return Send.success(res, null, "Signed out successfully.");
    } catch (error) {
        console.error("Sign out failed:", error);
        return Send.error(res, null, "Sign out failed.");
    }
}

const refreshToken = async (req: Request, res: Response) => {
    try {
        const { nhanVienId } = req.body;
        const refreshToken = req.cookies.refreshToken;

        const user = await prisma.taiKhoan.findUnique({
            where: { nhanVienId }
        });

        if (!user || !user.refreshToken) {
            return Send.unauthorized(res, "Please sign in again.");
        }

        if (user.refreshToken !== refreshToken) {
            return Send.unauthorized(res, "Please sign in again.");
        }

        const newAccessToken = jwt.sign(
            { userId: user.nhanVienId },
            process.env.AUTH_SECRET!,
            { expiresIn: '15m' }
        )

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 15 * 60 * 1000, // 15 minutes
            sameSite: "strict"
        })

        return Send.success(res, null, "Token refreshed successfully.");
    } catch (error) {
        console.error("Token refresh failed:", error);
        return Send.error(res, null, "Token refresh failed.");
    }
} 

const getAccountInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { nhanVienId } = req.body;

        const user = await prisma.taiKhoan.findUnique({
            where: { nhanVienId },
            select: {
                nhanVienId: true,
                tenDangNhap: true,
                createdAt: true,
                updatedAt: true,
                // Add other fields you want to return
            }
        });

        if (!user) {
            return Send.notFound(res, {}, "User not found.");
        }

        return Send.success(res, { user });
    } catch (error) {
        next(error);
    }
}

export default {
    login,
    createAccount,
    changePassword,
    logout,
    refreshToken,
    getAccountInfo
}