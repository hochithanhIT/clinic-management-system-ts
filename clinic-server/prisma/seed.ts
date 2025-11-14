import { PrismaClient, Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding TinhTP...");

  const tinhTpPath = path.join(__dirname, "tinh_tp.json");
  const tinhTpData = JSON.parse(fs.readFileSync(tinhTpPath, "utf-8"));

  for (const tinh of tinhTpData) {
    await prisma.tinhTP.upsert({
      where: { maTinhTP: tinh.maTinhTP },
      update: {},
      create: {
        maTinhTP: tinh.maTinhTP,
        tenTinhTP: tinh.tenTinhTP,
      },
    });
  }

  console.log("Seeding finished TinhTP.");
  console.log("Start seeding XaPhuong...");

  const xaPhuongPath = path.join(__dirname, "xa_phuong.json");
  const xaPhuongRaw = JSON.parse(fs.readFileSync(xaPhuongPath, "utf-8"));

  const tinhRows = await prisma.tinhTP.findMany({
    select: { id: true, maTinhTP: true },
  });
  const tinhMap = new Map(tinhRows.map((t) => [t.maTinhTP, t.id]));

  const toInsert = [];
  let invalid = 0;
  for (const xa of xaPhuongRaw) {
    const { maXaPhuong, tenXaPhuong, maTinhTP } = xa || {};
    const tinhTPId = maTinhTP ? tinhMap.get(maTinhTP) : undefined;

    if (!maXaPhuong || !tenXaPhuong || !tinhTPId) {
      invalid++;
      continue;
    }

    toInsert.push({ maXaPhuong, tenXaPhuong, tinhTPId });
  }

  let inserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const res = await prisma.xaPhuong.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    inserted += res.count || 0;
  }

  console.log(
    `Seeding finished XaPhuong. Inserted: ${inserted}, Skipped/Invalid: ${invalid}`
  );
  console.log("Start seeding Khoa.");

  const khoaPath = path.join(__dirname, "khoa.json");
  const khoaData = JSON.parse(fs.readFileSync(khoaPath, "utf-8"));

  const khoaToInsert = [];
  const seenTen = new Set();
  for (const k of khoaData) {
    const ten = k?.tenKhoa?.trim();
    if (!ten || seenTen.has(ten)) continue;
    seenTen.add(ten);
    khoaToInsert.push({ tenKhoa: ten });
  }

  let insertedKhoa = 0;
  if (khoaToInsert.length) {
    const res = await prisma.khoa.createMany({
      data: khoaToInsert,
      skipDuplicates: true,
    });
    insertedKhoa = res.count || 0;
  }

  console.log(`Seeding finished Khoa. Inserted: ${insertedKhoa}`);
  console.log("Start seeding NgheNghiep...");

  const nghePath = path.join(__dirname, "nghe_nghiep.json");
  const ngheData = JSON.parse(fs.readFileSync(nghePath, "utf-8"));

  const seenMaNN = new Set();
  const ngheToInsert = [];
  for (const n of ngheData) {
    const ma = n?.maNgheNghiep?.trim();
    const ten = n?.tenNgheNghiep?.trim();
    if (!ma || !ten || seenMaNN.has(ma)) continue;
    seenMaNN.add(ma);
    ngheToInsert.push({ maNgheNghiep: ma, tenNgheNghiep: ten });
  }

  let insertedNghe = 0;
  for (let i = 0; i < ngheToInsert.length; i += CHUNK) {
    const chunk = ngheToInsert.slice(i, i + CHUNK);
    const res = await prisma.ngheNghiep.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    insertedNghe += res.count || 0;
  }

  console.log(`Seeding finished NgheNghiep. Inserted: ${insertedNghe}`);
  console.log("Start seeding VaiTro...");

  const vaiTroPath = path.join(__dirname, "vai_tro.json");
  const vaiTroData = JSON.parse(fs.readFileSync(vaiTroPath, "utf-8"));

  const vaiTroToInsert = [];
  const seenVaiTro = new Set();
  for (const v of vaiTroData) {
    const ten = v?.tenVaiTro?.trim();
    if (!ten || seenVaiTro.has(ten)) continue;
    seenVaiTro.add(ten);
    vaiTroToInsert.push({ tenVaiTro: ten });
  }

  let insertedVaiTro = 0;
  if (vaiTroToInsert.length) {
    const res = await prisma.vaiTro.createMany({
      data: vaiTroToInsert,
      skipDuplicates: true,
    });
    insertedVaiTro = res.count || 0;
  }

  console.log(`Seeding finished VaiTro. Inserted: ${insertedVaiTro}`);
  console.log("Start seeding Benh...");

  const benhPath = path.join(__dirname, "benh.json");
  const benhData = JSON.parse(fs.readFileSync(benhPath, "utf-8"));

  const benhToInsert = [];
  const seenTenBenh = new Set();
  for (const b of benhData) {
    const ma = b?.maICD10?.trim();
    const ten = b?.tenBenh?.trim();
    if (!ma || !ten || seenTenBenh.has(ma)) continue;
    seenTenBenh.add(ma);
    benhToInsert.push({ maICD10: ma, tenBenh: ten });
  }

  let insertedBenh = 0;
  for (let i = 0; i < benhToInsert.length; i += CHUNK) {
    const chunk = benhToInsert.slice(i, i + CHUNK);
    const res = await prisma.benh.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    insertedBenh += res.count || 0;
  }

  console.log(`Seeding finished Benh. Inserted: ${insertedBenh}`);
  console.log("Start seeding ChucVu...");

  const chucVuPath = path.join(__dirname, "chuc_vu.json");
  const chucVuData = JSON.parse(fs.readFileSync(chucVuPath, "utf-8"));

  const chucVuToInsert = [];
  const seenTenChucVu = new Set();
  for (const c of chucVuData) {
    const ten = c?.tenChucVu?.trim();
    if (!ten || seenTenChucVu.has(ten)) continue;
    seenTenChucVu.add(ten);
    chucVuToInsert.push({ tenChucVu: ten });
  }

  let insertedChucVu = 0;
  if (chucVuToInsert.length) {
    const res = await prisma.chucVu.createMany({
      data: chucVuToInsert,
      skipDuplicates: true,
    });
    insertedChucVu = res.count || 0;
  }

  console.log(`Seeding finished ChucVu. Inserted: ${insertedChucVu}`);
  console.log("Start seeding ChucDanh...");

  const chucDanhPath = path.join(__dirname, "chuc_danh.json");
  const chucDanhData = JSON.parse(fs.readFileSync(chucDanhPath, "utf-8"));

  const chucDanhToInsert = [];
  const seenTenChucDanh = new Set();
  for (const c of chucDanhData) {
    const ten = c?.tenChucDanh?.trim();
    if (!ten || seenTenChucDanh.has(ten)) continue;
    seenTenChucDanh.add(ten);
    chucDanhToInsert.push({ tenChucDanh: ten });
  }

  let insertedChucDanh = 0;
  if (chucDanhToInsert.length) {
    const res = await prisma.chucDanh.createMany({
      data: chucDanhToInsert,
      skipDuplicates: true,
    });
    insertedChucDanh = res.count || 0;
  }

  console.log(`Seeding finished ChucDanh. Inserted: ${insertedChucDanh}`);
  console.log("Start seeding LoaiDichVu...");

  const loaiDichVuPath = path.join(__dirname, "loai_dich_vu.json");
  const loaiDichVuData = JSON.parse(fs.readFileSync(loaiDichVuPath, "utf-8"));

  const loaiDichVuToInsert = [];
  const seenTenLoai = new Set();
  for (const l of loaiDichVuData) {
    const ten = l?.tenLoai?.trim();
    if (!ten || seenTenLoai.has(ten)) continue;
    seenTenLoai.add(ten);
    loaiDichVuToInsert.push({ tenLoai: ten });
  }

  let insertedLoaiDichVu = 0;
  if (loaiDichVuToInsert.length) {
    const res = await prisma.loaiDichVu.createMany({
      data: loaiDichVuToInsert,
      skipDuplicates: true,
    });
    insertedLoaiDichVu = res.count || 0;
  }

  console.log(`Seeding finished LoaiDichVu. Inserted: ${insertedLoaiDichVu}`);
  console.log("Start seeding NhomDichVu...");

  const nhomDvPath = path.join(__dirname, "nhom_dich_vu.json");
  const nhomDvData = JSON.parse(fs.readFileSync(nhomDvPath, "utf-8"));

  // Kiểm tra ldvId hợp lệ từ bảng LoaiDichVu
  const ldvRows = await prisma.loaiDichVu.findMany({ select: { id: true } });
  const ldvSet = new Set(ldvRows.map((r) => r.id));

  const nhomDvToInsert = [];
  const seenPair = new Set(); // tránh trùng trong input theo (ldvId, tenNhomDV)
  for (const n of nhomDvData) {
    const ten = n?.tenNhomDV?.trim();
    const ldvId = Number(n?.ldvId);
    if (!ten || !Number.isInteger(ldvId) || !ldvSet.has(ldvId)) continue;

    const key = `${ldvId}::${ten.toLowerCase()}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);

    nhomDvToInsert.push({ tenNhomDV: ten, ldvId });
  }

  let insertedNhomDv = 0;
  for (let i = 0; i < nhomDvToInsert.length; i += CHUNK) {
    const chunk = nhomDvToInsert.slice(i, i + CHUNK);
    const res = await prisma.nhomDichVu.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    insertedNhomDv += res.count || 0;
  }

  console.log(`Seeding finished NhomDichVu. Inserted: ${insertedNhomDv}`);
  console.log('Start seeding Phong...')

  const phongPath = path.join(__dirname, 'phong.json');
  const phongData = JSON.parse(fs.readFileSync(phongPath, 'utf-8'));

  const khoaRows2 = await prisma.khoa.findMany({ select: { id: true } });
  const khoaSet = new Set(khoaRows2.map(k => k.id));

  const phongToInsert = [];
  const seenPhong = new Set();
  for (const p of phongData) {
      const ten = p?.tenPhong?.trim();
      const khoaId = Number(p?.khoaId);
      if (!ten || !Number.isInteger(khoaId) || !khoaSet.has(khoaId)) continue;

      const key = `${khoaId}::${ten.toLowerCase()}`;
      if (seenPhong.has(key)) continue;
      seenPhong.add(key);

      phongToInsert.push({ tenPhong: ten, khoaId });
  }

  let insertedPhong = 0;
  for (let i = 0; i < phongToInsert.length; i += CHUNK) {
      const chunk = phongToInsert.slice(i, i + CHUNK);
      const res = await prisma.phong.createMany({
          data: chunk,
          skipDuplicates: true // hiệu lực khi có unique index
      });
      insertedPhong += res.count || 0;
  }

  console.log(`Seeding finished Phong. Inserted: ${insertedPhong}`);
  console.log("Start seeding DichVu...");

  const dvPath = path.join(__dirname, "dich_vu.json");
  const dvRaw = JSON.parse(fs.readFileSync(dvPath, "utf-8"));

  // Lấy danh sách nhóm dịch vụ hợp lệ
  const ndvRows = await prisma.nhomDichVu.findMany({ select: { id: true } });
  const ndvSet = new Set(ndvRows.map((r) => r.id));

  const dvToInsert = [];
  const seenMa = new Set();

  for (const dv of dvRaw) {
    const maDV = dv?.maDV?.trim();
    const tenDV = dv?.tenDV?.trim();
    const donVi = dv?.donVi?.trim() || null;
    const ndvId = Number(dv?.ndvId);

    if (!maDV || !tenDV || !Number.isInteger(ndvId) || !ndvSet.has(ndvId))
      continue;
    if (seenMa.has(maDV)) continue;

    // donGia bắt buộc, lưu Decimal
    const rawGia = dv?.donGia;
    if (rawGia === null || rawGia === undefined || String(rawGia).trim() === "")
      continue;

    let donGia;
    try {
      donGia = new Prisma.Decimal(String(rawGia));
    } catch {
      continue;
    }

    // Tham chiếu dạng chuỗi (schema là String?)
    const thamChieuMin =
      dv?.thamChieuMin == null ? null : String(dv.thamChieuMin);
    const thamChieuMax =
      dv?.thamChieuMax == null ? null : String(dv.thamChieuMax);

    dvToInsert.push({
      maDV,
      tenDV,
      donVi,
      donGia,
      thamChieuMin,
      thamChieuMax,
      ndvId,
    });
    seenMa.add(maDV);
  }

  let insertedDV = 0;
  for (let i = 0; i < dvToInsert.length; i += CHUNK) {
    const chunk = dvToInsert.slice(i, i + CHUNK);
    const res = await prisma.dichVu.createMany({
      data: chunk,
      skipDuplicates: true, // dựa trên unique DV.maDV
    });
    insertedDV += res.count || 0;
  }

  console.log(`Seeding finished DichVu. Inserted: ${insertedDV}`);
  console.log('Start seeding NhanVien...');

  const nvPath = path.join(__dirname, 'nhan_vien.json');
  const nvRaw = JSON.parse(fs.readFileSync(nvPath, 'utf-8'));

  // Validate FK sets
  const [khoaRows, cdRows, cvRows, vtRows] = await Promise.all([
    prisma.khoa.findMany({ select: { id: true } }),
    prisma.chucDanh.findMany({ select: { id: true } }),
    prisma.chucVu.findMany({ select: { id: true } }),
    prisma.vaiTro.findMany({ select: { id: true } }),
  ]);

  const khoa2Set = new Set(khoaRows.map(r => r.id));
  const cdSet = new Set(cdRows.map(r => r.id));
  const cvSet = new Set(cvRows.map(r => r.id));
  const vtSet = new Set(vtRows.map(r => r.id));

  const nvToInsert = [];
  const seenMaNV = new Set();
  let invalidFk = 0, fixedDates = 0;

  for (const nv of nvRaw) {
    const maNV = nv?.maNV?.trim();
    const hoTen = nv?.hoTen?.trim();
    const gioiTinh = Number(nv?.gioiTinh);
    const khoaId = Number(nv?.khoaId);
    const chucDanhId = Number(nv?.chucDanhId);
    const chucVuId = Number(nv?.chucVuId);
    const vaiTroId = Number(nv?.vaiTroId);

    if (!maNV || !hoTen || !Number.isInteger(gioiTinh)) continue;
    if (!Number.isInteger(khoaId) || !khoa2Set.has(khoaId) ||
        !Number.isInteger(chucDanhId) || !cdSet.has(chucDanhId) ||
        !Number.isInteger(chucVuId) || !cvSet.has(chucVuId) ||
        !Number.isInteger(vaiTroId) || !vtSet.has(vaiTroId)) { invalidFk++; continue; }
    if (seenMaNV.has(maNV)) continue;
    seenMaNV.add(maNV);  

    nvToInsert.push({
      maNV,
      hoTen,
      ngaySinh: nv?.ngaySinh || null,                 // Date
      gioiTinh,
      sdt: nv?.sdt?.trim() || null,
      soChungChiHanhNghe: nv?.soChungChiHanhNghe?.trim() || null,
      ngayCapChungChi: nv?.ngayCapChungChi || null,          // Date | null
      ngayHetHanChungChi: nv?.ngayHetHanChungChi || null,       // Date | null
      khoaId,
      chucDanhId,
      chucVuId,
      vaiTroId,
    });
  }

  let insertedNV = 0;
  for (let i = 0; i < nvToInsert.length; i += CHUNK) {
    const chunk = nvToInsert.slice(i, i + CHUNK);
    const res = await prisma.nhanVien.createMany({
      data: chunk,
      skipDuplicates: true // dựa trên unique NV.maNV
    });
    insertedNV += res.count || 0;
  }

  console.log(`Seeding finished NhanVien. Inserted: ${insertedNV}, Input: ${nvToInsert.length}, Invalid FK: ${invalidFk}, Converted DD-MM-YYYY: ${fixedDates}`);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
