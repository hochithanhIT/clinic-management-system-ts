import authController from "../controllers/auth.controller";
import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import authSchema from "../validations/auth.schema";

const router = express.Router();

router
    .post("/login", authController.login)
    .post(
        "/create-account",
        ValidationMiddleware.validateBody(authSchema.createAccount),
        authController.createAccount,
    )
    .post(
        "/change-password",
        authMiddleware.authenticateUser,
        ValidationMiddleware.validateBody(authSchema.changePassword),
        authController.changePassword,
    )
    .post("/logout",authMiddleware.authenticateUser, authController.logout)
    .post("/refresh-token", authMiddleware.refreshTokenValidation, authController.refreshToken);

router
    .get("/", authMiddleware.authenticateUser, authController.getAccountInfo);
export default router;