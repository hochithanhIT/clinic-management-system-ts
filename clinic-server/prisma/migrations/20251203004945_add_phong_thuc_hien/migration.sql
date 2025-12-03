-- AlterTable
ALTER TABLE "DichVu" ADD COLUMN     "DV_PhongThucHienID" INTEGER;

-- AddForeignKey
ALTER TABLE "DichVu" ADD CONSTRAINT "DichVu_DV_PhongThucHienID_fkey" FOREIGN KEY ("DV_PhongThucHienID") REFERENCES "Phong"("Phong_ID") ON DELETE SET NULL ON UPDATE CASCADE;
