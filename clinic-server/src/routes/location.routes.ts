import express from "express";
import authMiddleware from "../middlewares/auth.middleware";
import locationController from "../controllers/location.controller";
import ValidationMiddleware from "../middlewares/validation.middleware";
import locationSchema from "../validations/location.schema";

const router = express.Router();

router.get(
  "/provinces",
  authMiddleware.authenticateUser,
  locationController.getProvinces
);

router.post(
  "/provinces",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(locationSchema.addProvinceBody),
  locationController.addProvince
);

router.put(
  "/provinces/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(locationSchema.updateProvinceBody),
  locationController.updateProvince
);

router.delete(
  "/provinces/:id",
  authMiddleware.authenticateUser,
  locationController.deleteProvince
);

router.get(
  "/cities",
  authMiddleware.authenticateUser,
  locationController.getCities
);

router.post(
  "/cities",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(locationSchema.addCityBody),
  locationController.addCity
);

router.put(
  "/cities/:id",
  authMiddleware.authenticateUser,
  ValidationMiddleware.validateBody(locationSchema.updateCityBody),
  locationController.updateCity
);

router.delete(
  "/cities/:id",
  authMiddleware.authenticateUser,
  locationController.deleteCity
);

export default router;
