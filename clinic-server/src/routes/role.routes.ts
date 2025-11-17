import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import roleController from "../controllers/role.controller";
import ValidationMiddleware from "../middlewares/validation.middleware";
import { roleBody, updateRoleBody } from "../validations/reference.schema";

const router = express.Router();

router.get("/", authMiddleware.authenticateUser, roleController.getRoles);

router.post(
	"/",
	authMiddleware.authenticateUser,
	ValidationMiddleware.validateBody(roleBody),
	roleController.addRole,
);

router.put(
	"/:id",
	authMiddleware.authenticateUser,
	ValidationMiddleware.validateBody(updateRoleBody),
	roleController.updateRole,
);

router.delete(
	"/:id",
	authMiddleware.authenticateUser,
	roleController.deleteRole,
);

export default router;
