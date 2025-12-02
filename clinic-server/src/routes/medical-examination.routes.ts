import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import ValidationMiddleware from "../middlewares/validation.middleware";
import medicalExaminationController from "../controllers/medicalExamination.controller";
import medicalExaminationSchema from "../validations/medical-examination.schema";

const router = express.Router();

router.get(
  "/medical-record/:medicalRecordId",
  authMiddleware.authenticateUser,
  medicalExaminationController.getMedicalExaminationByMedicalRecord,
);

router.get(
  "/:id",
  authMiddleware.authenticateUser,
  medicalExaminationController.getMedicalExamination,
);

router.post(
  "/",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(
    medicalExaminationSchema.createMedicalExaminationBody,
  ),
  medicalExaminationController.createMedicalExamination,
);

router.put(
  "/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(
    medicalExaminationSchema.updateMedicalExaminationBody,
  ),
  medicalExaminationController.updateMedicalExamination,
);

router.put(
  "/:id/diagnosis",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(
    medicalExaminationSchema.updateDiagnosisBody,
  ),
  medicalExaminationController.updateDiagnosis,
);

router.delete(
  "/:id",
  authMiddleware.authenticateUser,
  medicalExaminationController.deleteMedicalExamination,
);

export default router;
