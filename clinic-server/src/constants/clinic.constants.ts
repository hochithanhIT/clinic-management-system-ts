import dotenv from "dotenv";

dotenv.config();

const toNumber = (value: string | undefined, defaultValue: number) => {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const clinicConstants = {
  examServiceCode: process.env.EXAM_SERVICE_CODE?.trim() || "CK-KB-001",
  serviceOrderStatus: {
    pendingPayment: toNumber(process.env.SERVICE_ORDER_STATUS_PENDING_PAYMENT, 0),
    paid: toNumber(process.env.SERVICE_ORDER_STATUS_PAID, 1),
  },
  medicalRecordStatus: {
    waitingForExam: toNumber(process.env.MEDICAL_RECORD_STATUS_WAITING_FOR_EXAM, 0),
    inProgress: toNumber(process.env.MEDICAL_RECORD_STATUS_IN_PROGRESS, 1),
    completed: toNumber(process.env.MEDICAL_RECORD_STATUS_COMPLETED, 2),
  },
};

export default clinicConstants;
