-- CreateTable
CREATE TABLE "TinhTP" (
    "TinhTP_ID" SERIAL NOT NULL,
    "TinhTP_MaTinhTP" TEXT NOT NULL,
    "TinhTP_TenTinhTP" TEXT NOT NULL,

    CONSTRAINT "TinhTP_pkey" PRIMARY KEY ("TinhTP_ID")
);

-- CreateTable
CREATE TABLE "XaPhuong" (
    "XaPhuong_ID" SERIAL NOT NULL,
    "XaPhuong_MaXaPhuong" TEXT NOT NULL,
    "XaPhuong_TenXaPhuong" TEXT NOT NULL,
    "TinhTP_ID" INTEGER NOT NULL,

    CONSTRAINT "XaPhuong_pkey" PRIMARY KEY ("XaPhuong_ID")
);

-- CreateTable
CREATE TABLE "BenhNhan" (
    "BN_ID" SERIAL NOT NULL,
    "BN_MaBenhNhan" TEXT NOT NULL,
    "BN_HoTen" TEXT NOT NULL,
    "BN_NgaySinh" TIMESTAMP(3) NOT NULL,
    "BN_GioiTinh" INTEGER NOT NULL,
    "BN_SDT" TEXT,
    "BN_CCCD" TEXT,
    "BN_HoTenNguoiNha" TEXT,
    "BN_SDTNguoiNha" TEXT,
    "BN_QuanHe" TEXT,
    "NN_ID" INTEGER NOT NULL,
    "XaPhuong_ID" INTEGER NOT NULL,

    CONSTRAINT "BenhNhan_pkey" PRIMARY KEY ("BN_ID")
);

-- CreateTable
CREATE TABLE "NgheNghiep" (
    "NN_ID" SERIAL NOT NULL,
    "NN_MaNgheNghiep" TEXT NOT NULL,
    "NN_TenNgheNghiep" TEXT NOT NULL,

    CONSTRAINT "NgheNghiep_pkey" PRIMARY KEY ("NN_ID")
);

-- CreateTable
CREATE TABLE "NhanVien" (
    "NV_ID" SERIAL NOT NULL,
    "NV_MaNV" TEXT NOT NULL,
    "NV_HoTen" TEXT NOT NULL,
    "NV_NgaySinh" TIMESTAMP(3) NOT NULL,
    "NV_GioiTinh" INTEGER NOT NULL,
    "NV_SDT" TEXT,
    "NV_SoChungChiHanhNghe" TEXT,
    "NV_NgayCapChungChi" TIMESTAMP(3),
    "NV_NgayHetHanChungChi" TIMESTAMP(3),
    "NV_DaXoa" BOOLEAN NOT NULL DEFAULT false,
    "Khoa_ID" INTEGER NOT NULL,
    "CD_ID" INTEGER NOT NULL,
    "CV_ID" INTEGER NOT NULL,
    "VT_ID" INTEGER NOT NULL,

    CONSTRAINT "NhanVien_pkey" PRIMARY KEY ("NV_ID")
);

-- CreateTable
CREATE TABLE "TaiKhoan" (
    "TK_ID" SERIAL NOT NULL,
    "TK_TenDangNhap" TEXT NOT NULL,
    "TK_MatKhau" TEXT NOT NULL,
    "TK_TrangThai" BOOLEAN NOT NULL DEFAULT true,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "NV_ID" INTEGER NOT NULL,

    CONSTRAINT "TaiKhoan_pkey" PRIMARY KEY ("TK_ID")
);

-- CreateTable
CREATE TABLE "VaiTro" (
    "VT_ID" SERIAL NOT NULL,
    "VT_TenVT" TEXT NOT NULL,

    CONSTRAINT "VaiTro_pkey" PRIMARY KEY ("VT_ID")
);

-- CreateTable
CREATE TABLE "ChucVu" (
    "CV_ID" SERIAL NOT NULL,
    "CV_TenCV" TEXT NOT NULL,

    CONSTRAINT "ChucVu_pkey" PRIMARY KEY ("CV_ID")
);

-- CreateTable
CREATE TABLE "ChucDanh" (
    "CD_ID" SERIAL NOT NULL,
    "CD_TenChucDanh" TEXT NOT NULL,

    CONSTRAINT "ChucDanh_pkey" PRIMARY KEY ("CD_ID")
);

-- CreateTable
CREATE TABLE "Khoa" (
    "Khoa_ID" SERIAL NOT NULL,
    "Khoa_TenKhoa" TEXT NOT NULL,

    CONSTRAINT "Khoa_pkey" PRIMARY KEY ("Khoa_ID")
);

-- CreateTable
CREATE TABLE "Phong" (
    "Phong_ID" SERIAL NOT NULL,
    "Phong_TenPhong" TEXT NOT NULL,
    "Khoa_ID" INTEGER NOT NULL,

    CONSTRAINT "Phong_pkey" PRIMARY KEY ("Phong_ID")
);

-- CreateTable
CREATE TABLE "BenhAn" (
    "BA_ID" SERIAL NOT NULL,
    "BA_MaBA" TEXT NOT NULL,
    "BA_ThoiGianVao" TIMESTAMP(3) NOT NULL,
    "BA_LyDoKhamBenh" TEXT NOT NULL,
    "BA_TrangThai" INTEGER NOT NULL,
    "BA_ThoiGianKetThuc" TIMESTAMP(3),
    "BN_ID" INTEGER NOT NULL,
    "NV_ID_TiepNhan" INTEGER NOT NULL,
    "NV_ID_Kham" INTEGER NOT NULL,

    CONSTRAINT "BenhAn_pkey" PRIMARY KEY ("BA_ID")
);

-- CreateTable
CREATE TABLE "PhieuKhamBenh" (
    "PKB_ID" SERIAL NOT NULL,
    "PKB_MaPhieu" TEXT NOT NULL,
    "PKB_ThoiGianKham" TIMESTAMP(3) NOT NULL,
    "PKB_QuaTrinhBenhLy" TEXT,
    "PKB_TienSuBanThan" TEXT,
    "PKB_TienSuGiaDinh" TEXT,
    "PKB_KhamToanThan" TEXT,
    "PKB_KhamBoPhan" TEXT,
    "PKB_Mach" INTEGER,
    "PKB_NhietDo" DOUBLE PRECISION,
    "PKB_NhipTho" INTEGER,
    "PKB_CanNang" DOUBLE PRECISION,
    "PKB_ChieuCao" DOUBLE PRECISION,
    "PKB_HuyetApTThu" INTEGER,
    "PKB_HuyetApTTr" INTEGER,
    "PKB_BMI" DOUBLE PRECISION,
    "PKB_PhuongPhapDieuTri" TEXT,
    "PKB_XuTri" TEXT,
    "BA_ID" INTEGER NOT NULL,

    CONSTRAINT "PhieuKhamBenh_pkey" PRIMARY KEY ("PKB_ID")
);

-- CreateTable
CREATE TABLE "Benh" (
    "Benh_ID" SERIAL NOT NULL,
    "Benh_MaICD10" TEXT NOT NULL,
    "Benh_TenBenh" TEXT NOT NULL,

    CONSTRAINT "Benh_pkey" PRIMARY KEY ("Benh_ID")
);

-- CreateTable
CREATE TABLE "ChanDoan" (
    "PKB_ID" INTEGER NOT NULL,
    "Benh_ID" INTEGER NOT NULL,
    "CD_BenhChinh" BOOLEAN NOT NULL,

    CONSTRAINT "ChanDoan_pkey" PRIMARY KEY ("PKB_ID","Benh_ID")
);

-- CreateTable
CREATE TABLE "PhieuChiDinh" (
    "PCD_ID" SERIAL NOT NULL,
    "PCD_MaPhieuCD" TEXT NOT NULL,
    "PCD_ThoiGianTao" TIMESTAMP(3) NOT NULL,
    "PCD_TrangThai" INTEGER NOT NULL,
    "BA_ID" INTEGER NOT NULL,

    CONSTRAINT "PhieuChiDinh_pkey" PRIMARY KEY ("PCD_ID")
);

-- CreateTable
CREATE TABLE "ChiTietPhieuChiDinh" (
    "CTPCD_ID" SERIAL NOT NULL,
    "CTPCD_SoLuong" INTEGER NOT NULL,
    "CTPCD_TongTien" DECIMAL(65,30) NOT NULL,
    "CTPCD_YeuCauKQ" BOOLEAN NOT NULL,
    "CTPCD_TrangThaiDongTien" BOOLEAN NOT NULL DEFAULT false,
    "PCD_ID" INTEGER NOT NULL,
    "DV_ID" INTEGER NOT NULL,

    CONSTRAINT "ChiTietPhieuChiDinh_pkey" PRIMARY KEY ("CTPCD_ID")
);

-- CreateTable
CREATE TABLE "DichVu" (
    "DV_ID" SERIAL NOT NULL,
    "DV_MaDV" TEXT NOT NULL,
    "DV_TenDV" TEXT NOT NULL,
    "DV_DonVi" TEXT,
    "DV_DonGia" DECIMAL(65,30) NOT NULL,
    "DV_ThamChieuMin" TEXT,
    "DV_ThamChieuMax" TEXT,
    "NDV_ID" INTEGER NOT NULL,

    CONSTRAINT "DichVu_pkey" PRIMARY KEY ("DV_ID")
);

-- CreateTable
CREATE TABLE "NhomDichVu" (
    "NDV_ID" SERIAL NOT NULL,
    "NDV_TenNhomDV" TEXT NOT NULL,
    "LDV_ID" INTEGER NOT NULL,

    CONSTRAINT "NhomDichVu_pkey" PRIMARY KEY ("NDV_ID")
);

-- CreateTable
CREATE TABLE "LoaiDichVu" (
    "LDV_ID" SERIAL NOT NULL,
    "LDV_TenLoai" TEXT NOT NULL,

    CONSTRAINT "LoaiDichVu_pkey" PRIMARY KEY ("LDV_ID")
);

-- CreateTable
CREATE TABLE "KetQua" (
    "KQ_ID" SERIAL NOT NULL,
    "KQ_TGTiepNhan" TIMESTAMP(3) NOT NULL,
    "KQ_TGThucHien" TIMESTAMP(3) NOT NULL,
    "KQ_TGTraKQ" TIMESTAMP(3) NOT NULL,
    "KQ_KetQua" TEXT NOT NULL,
    "KQ_KetLuan" TEXT NOT NULL,
    "KQ_GhiChu" TEXT,
    "KQ_URL" TEXT,
    "CTPCD_ID" INTEGER NOT NULL,

    CONSTRAINT "KetQua_pkey" PRIMARY KEY ("KQ_ID")
);

-- CreateTable
CREATE TABLE "KetQuaChiTiet" (
    "KQCT_ID" SERIAL NOT NULL,
    "KQCT_ChiSo" TEXT NOT NULL,
    "KQCT_GiaTri" TEXT NOT NULL,
    "KQCT_BatThuong" BOOLEAN NOT NULL,
    "KQ_ID" INTEGER NOT NULL,

    CONSTRAINT "KetQuaChiTiet_pkey" PRIMARY KEY ("KQCT_ID")
);

-- CreateTable
CREATE TABLE "HoaDon" (
    "HD_ID" SERIAL NOT NULL,
    "HD_MaHD" TEXT NOT NULL,
    "HD_NgayLap" TIMESTAMP(3) NOT NULL,
    "HD_TongTien" DECIMAL(65,30) NOT NULL,
    "HD_TrangThai" INTEGER NOT NULL,
    "BA_ID" INTEGER NOT NULL,
    "NV_ID" INTEGER NOT NULL,

    CONSTRAINT "HoaDon_pkey" PRIMARY KEY ("HD_ID")
);

-- CreateTable
CREATE TABLE "HoaDonChiTiet" (
    "HDCT_ID" SERIAL NOT NULL,
    "HDCT_SoLuong" INTEGER NOT NULL,
    "HDCT_ThanhTien" DECIMAL(65,30) NOT NULL,
    "HD_ID" INTEGER NOT NULL,
    "CTPCD_ID" INTEGER NOT NULL,

    CONSTRAINT "HoaDonChiTiet_pkey" PRIMARY KEY ("HDCT_ID")
);

-- CreateIndex
CREATE UNIQUE INDEX "TinhTP_TinhTP_MaTinhTP_key" ON "TinhTP"("TinhTP_MaTinhTP");

-- CreateIndex
CREATE UNIQUE INDEX "XaPhuong_XaPhuong_MaXaPhuong_key" ON "XaPhuong"("XaPhuong_MaXaPhuong");

-- CreateIndex
CREATE UNIQUE INDEX "BenhNhan_BN_MaBenhNhan_key" ON "BenhNhan"("BN_MaBenhNhan");

-- CreateIndex
CREATE UNIQUE INDEX "BenhNhan_BN_SDT_key" ON "BenhNhan"("BN_SDT");

-- CreateIndex
CREATE UNIQUE INDEX "BenhNhan_BN_CCCD_key" ON "BenhNhan"("BN_CCCD");

-- CreateIndex
CREATE UNIQUE INDEX "NgheNghiep_NN_MaNgheNghiep_key" ON "NgheNghiep"("NN_MaNgheNghiep");

-- CreateIndex
CREATE UNIQUE INDEX "NhanVien_NV_MaNV_key" ON "NhanVien"("NV_MaNV");

-- CreateIndex
CREATE UNIQUE INDEX "NhanVien_NV_SDT_key" ON "NhanVien"("NV_SDT");

-- CreateIndex
CREATE UNIQUE INDEX "NhanVien_NV_SoChungChiHanhNghe_key" ON "NhanVien"("NV_SoChungChiHanhNghe");

-- CreateIndex
CREATE UNIQUE INDEX "TaiKhoan_TK_TenDangNhap_key" ON "TaiKhoan"("TK_TenDangNhap");

-- CreateIndex
CREATE UNIQUE INDEX "TaiKhoan_NV_ID_key" ON "TaiKhoan"("NV_ID");

-- CreateIndex
CREATE UNIQUE INDEX "VaiTro_VT_TenVT_key" ON "VaiTro"("VT_TenVT");

-- CreateIndex
CREATE UNIQUE INDEX "ChucVu_CV_TenCV_key" ON "ChucVu"("CV_TenCV");

-- CreateIndex
CREATE UNIQUE INDEX "ChucDanh_CD_TenChucDanh_key" ON "ChucDanh"("CD_TenChucDanh");

-- CreateIndex
CREATE UNIQUE INDEX "Khoa_Khoa_TenKhoa_key" ON "Khoa"("Khoa_TenKhoa");

-- CreateIndex
CREATE UNIQUE INDEX "BenhAn_BA_MaBA_key" ON "BenhAn"("BA_MaBA");

-- CreateIndex
CREATE UNIQUE INDEX "PhieuKhamBenh_PKB_MaPhieu_key" ON "PhieuKhamBenh"("PKB_MaPhieu");

-- CreateIndex
CREATE UNIQUE INDEX "PhieuKhamBenh_BA_ID_key" ON "PhieuKhamBenh"("BA_ID");

-- CreateIndex
CREATE UNIQUE INDEX "Benh_Benh_MaICD10_key" ON "Benh"("Benh_MaICD10");

-- CreateIndex
CREATE UNIQUE INDEX "PhieuChiDinh_PCD_MaPhieuCD_key" ON "PhieuChiDinh"("PCD_MaPhieuCD");

-- CreateIndex
CREATE UNIQUE INDEX "DichVu_DV_MaDV_key" ON "DichVu"("DV_MaDV");

-- CreateIndex
CREATE UNIQUE INDEX "NDV_TenNhomDV_LDV_ID_key" ON "NhomDichVu"("NDV_TenNhomDV", "LDV_ID");

-- CreateIndex
CREATE UNIQUE INDEX "LoaiDichVu_LDV_TenLoai_key" ON "LoaiDichVu"("LDV_TenLoai");

-- CreateIndex
CREATE UNIQUE INDEX "KetQua_CTPCD_ID_key" ON "KetQua"("CTPCD_ID");

-- CreateIndex
CREATE UNIQUE INDEX "KetQuaChiTiet_KQ_ID_key" ON "KetQuaChiTiet"("KQ_ID");

-- CreateIndex
CREATE UNIQUE INDEX "HoaDon_HD_MaHD_key" ON "HoaDon"("HD_MaHD");

-- AddForeignKey
ALTER TABLE "XaPhuong" ADD CONSTRAINT "XaPhuong_TinhTP_ID_fkey" FOREIGN KEY ("TinhTP_ID") REFERENCES "TinhTP"("TinhTP_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenhNhan" ADD CONSTRAINT "BenhNhan_NN_ID_fkey" FOREIGN KEY ("NN_ID") REFERENCES "NgheNghiep"("NN_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenhNhan" ADD CONSTRAINT "BenhNhan_XaPhuong_ID_fkey" FOREIGN KEY ("XaPhuong_ID") REFERENCES "XaPhuong"("XaPhuong_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhanVien" ADD CONSTRAINT "NhanVien_Khoa_ID_fkey" FOREIGN KEY ("Khoa_ID") REFERENCES "Khoa"("Khoa_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhanVien" ADD CONSTRAINT "NhanVien_CD_ID_fkey" FOREIGN KEY ("CD_ID") REFERENCES "ChucDanh"("CD_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhanVien" ADD CONSTRAINT "NhanVien_CV_ID_fkey" FOREIGN KEY ("CV_ID") REFERENCES "ChucVu"("CV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhanVien" ADD CONSTRAINT "NhanVien_VT_ID_fkey" FOREIGN KEY ("VT_ID") REFERENCES "VaiTro"("VT_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaiKhoan" ADD CONSTRAINT "TaiKhoan_NV_ID_fkey" FOREIGN KEY ("NV_ID") REFERENCES "NhanVien"("NV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phong" ADD CONSTRAINT "Phong_Khoa_ID_fkey" FOREIGN KEY ("Khoa_ID") REFERENCES "Khoa"("Khoa_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenhAn" ADD CONSTRAINT "BenhAn_BN_ID_fkey" FOREIGN KEY ("BN_ID") REFERENCES "BenhNhan"("BN_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenhAn" ADD CONSTRAINT "BenhAn_NV_ID_TiepNhan_fkey" FOREIGN KEY ("NV_ID_TiepNhan") REFERENCES "NhanVien"("NV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenhAn" ADD CONSTRAINT "BenhAn_NV_ID_Kham_fkey" FOREIGN KEY ("NV_ID_Kham") REFERENCES "NhanVien"("NV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhieuKhamBenh" ADD CONSTRAINT "PhieuKhamBenh_BA_ID_fkey" FOREIGN KEY ("BA_ID") REFERENCES "BenhAn"("BA_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChanDoan" ADD CONSTRAINT "ChanDoan_PKB_ID_fkey" FOREIGN KEY ("PKB_ID") REFERENCES "PhieuKhamBenh"("PKB_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChanDoan" ADD CONSTRAINT "ChanDoan_Benh_ID_fkey" FOREIGN KEY ("Benh_ID") REFERENCES "Benh"("Benh_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhieuChiDinh" ADD CONSTRAINT "PhieuChiDinh_BA_ID_fkey" FOREIGN KEY ("BA_ID") REFERENCES "BenhAn"("BA_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChiTietPhieuChiDinh" ADD CONSTRAINT "ChiTietPhieuChiDinh_PCD_ID_fkey" FOREIGN KEY ("PCD_ID") REFERENCES "PhieuChiDinh"("PCD_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChiTietPhieuChiDinh" ADD CONSTRAINT "ChiTietPhieuChiDinh_DV_ID_fkey" FOREIGN KEY ("DV_ID") REFERENCES "DichVu"("DV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DichVu" ADD CONSTRAINT "DichVu_NDV_ID_fkey" FOREIGN KEY ("NDV_ID") REFERENCES "NhomDichVu"("NDV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NhomDichVu" ADD CONSTRAINT "NhomDichVu_LDV_ID_fkey" FOREIGN KEY ("LDV_ID") REFERENCES "LoaiDichVu"("LDV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KetQua" ADD CONSTRAINT "KetQua_CTPCD_ID_fkey" FOREIGN KEY ("CTPCD_ID") REFERENCES "ChiTietPhieuChiDinh"("CTPCD_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KetQuaChiTiet" ADD CONSTRAINT "KetQuaChiTiet_KQ_ID_fkey" FOREIGN KEY ("KQ_ID") REFERENCES "KetQua"("KQ_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDon" ADD CONSTRAINT "HoaDon_BA_ID_fkey" FOREIGN KEY ("BA_ID") REFERENCES "BenhAn"("BA_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDon" ADD CONSTRAINT "HoaDon_NV_ID_fkey" FOREIGN KEY ("NV_ID") REFERENCES "NhanVien"("NV_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDonChiTiet" ADD CONSTRAINT "HoaDonChiTiet_HD_ID_fkey" FOREIGN KEY ("HD_ID") REFERENCES "HoaDon"("HD_ID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoaDonChiTiet" ADD CONSTRAINT "HoaDonChiTiet_CTPCD_ID_fkey" FOREIGN KEY ("CTPCD_ID") REFERENCES "ChiTietPhieuChiDinh"("CTPCD_ID") ON DELETE RESTRICT ON UPDATE CASCADE;
