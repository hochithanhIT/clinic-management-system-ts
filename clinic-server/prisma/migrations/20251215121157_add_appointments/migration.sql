-- CreateTable
CREATE TABLE "Appointment" (
    "APPT_ID" SERIAL NOT NULL,
    "APPT_ScheduledAt" TIMESTAMP(3) NOT NULL,
    "APPT_Reason" TEXT NOT NULL,
    "APPT_Notes" TEXT,
    "Phong_ID" INTEGER NOT NULL,
    "BN_ID" INTEGER NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("APPT_ID")
);

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_Phong_ID_fkey" FOREIGN KEY ("Phong_ID") REFERENCES "Phong"("Phong_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_BN_ID_fkey" FOREIGN KEY ("BN_ID") REFERENCES "BenhNhan"("BN_ID") ON DELETE RESTRICT ON UPDATE CASCADE;
