import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import occupationSchema from "../validations/occupation.schema";
import occupationController from "../controllers/occupation.controller";

const router = Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  occupationController.getOccupations,
);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  occupationController.getOccupation,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(occupationSchema.addOccupationBody),
  occupationController.addOccupation,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(occupationSchema.updateOccupationBody),
  occupationController.updateOccupation,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  occupationController.deleteOccupation,
);

export default router;
