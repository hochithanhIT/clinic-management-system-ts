-- AlterTable
ALTER TABLE "PhieuChiDinh" ADD COLUMN     "NV_ID_ChiDinh" INTEGER;

-- AddForeignKey
ALTER TABLE "PhieuChiDinh" ADD CONSTRAINT "PhieuChiDinh_NV_ID_ChiDinh_fkey" FOREIGN KEY ("NV_ID_ChiDinh") REFERENCES "NhanVien"("NV_ID") ON DELETE SET NULL ON UPDATE CASCADE;
