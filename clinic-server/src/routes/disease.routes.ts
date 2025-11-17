import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import diseaseController from "../controllers/disease.controller";
import diseaseSchema from "../validations/disease.schema";

const router = express.Router();

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(diseaseSchema.addDiseaseBody),
  diseaseController.addDisease,
);

router.get(
  "/",
  authMiddleware.authenticateUser,
  diseaseController.getDiseases,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(diseaseSchema.updateDiseaseBody),
  diseaseController.updateDisease,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  diseaseController.deleteDisease,
);

export default router;
