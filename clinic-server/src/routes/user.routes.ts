import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import userController from "../controllers/user.controller";
import userSchema from "../validations/user.schema";

const router = express.Router();

router.get("/", authMiddleware.authenticateUser, userController.getUsers);

router.get(
	"/:id",
	authMiddleware.authenticateUser,
	userController.getUser
);

router.put(
	"/:id",
	authMiddleware.authenticateUser,
	ValidationMiddleware.validateBody(userSchema.updateUserBody),
	userController.updateUser
);

router.delete(
	"/:id",
	authMiddleware.authenticateUser,
	userController.deleteUser
);

export default router;
