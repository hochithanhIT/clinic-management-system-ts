import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import roomController from "../controllers/room.controller";
import ValidationMiddleware from "../middlewares/validation.middleware";
import roomSchema from "../validations/room.schema";

const router = express.Router();

router.get("/", authMiddleware.authenticateUser, roomController.getRooms);

router.post(
	"/",
	authMiddleware.authenticateUser,
	ValidationMiddleware.validateBody(roomSchema.addRoomBody),
	roomController.addRoom
);

router.put(
	"/:id",
	authMiddleware.authenticateUser,
	ValidationMiddleware.validateBody(roomSchema.updateRoomBody),
	roomController.updateRoom
);

router.delete(
	"/:id",
	authMiddleware.authenticateUser,
	roomController.deleteRoom
);

export default router;
