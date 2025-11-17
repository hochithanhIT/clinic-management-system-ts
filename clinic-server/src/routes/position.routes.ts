import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import positionController from "../controllers/position.controller";
import ValidationMiddleware from "../middlewares/validation.middleware";
import { positionBody, updatePositionBody } from "../validations/reference.schema";

const router = express.Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  positionController.getPositions,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(positionBody),
  positionController.addPosition,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(updatePositionBody),
  positionController.updatePosition,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  positionController.deletePosition,
);

export default router;
