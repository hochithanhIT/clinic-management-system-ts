import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import medicalRecordController from "../controllers/medicalRecord.controller";
import medicalRecordSchema from "../validations/medical-record.schema";

const router = express.Router();

router.get(
  "/",
  authMiddleware.authenticateUser,
  medicalRecordController.getMedicalRecords,
);

router.get(
  "/patient/:patientId",
  authMiddleware.authenticateUser,
  medicalRecordController.getMedicalRecordByPatient,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(medicalRecordSchema.createMedicalRecordBody),
  medicalRecordController.createMedicalRecord,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(medicalRecordSchema.updateMedicalRecordBody),
  medicalRecordController.updateMedicalRecord,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  medicalRecordController.deleteMedicalRecord,
);

export default router;
