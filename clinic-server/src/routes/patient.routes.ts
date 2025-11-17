import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import patientController from "../controllers/patient.controller";
import patientSchema from "../validations/patient.schema";

const router = express.Router();

router.get("/", authMiddleware.authenticateUser, patientController.getPatients);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  patientController.getPatient
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(patientSchema.addNewPatient),
  patientController.addNewPatient
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(patientSchema.updatePatientBody),
  patientController.updatePatient
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  patientController.deletePatient
);

export default router;
