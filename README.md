# QA Quality System

Aplikasi web Quality Assurance — **Dashboard**, **Complaint**, **Report QC**, dan **Verifikasi Quality** —
dibangun dengan **HTML + JavaScript murni (vanilla)** dan **Supabase (Postgres + Auth + Storage)** sebagai backend.

Tema warna: **White + Teal** (modern), lengkap dengan sidebar hamburger dan logo kosongan yang bisa kamu ganti sendiri.

---

## 1. Struktur folder

```
qa-app/
├── index.html          # Halaman Dashboard
├── complaint.html       # Halaman Complaint
├── report.html          # Halaman Report QC
├── verifikasi.html       # Halaman Verifikasi Quality (After CIP & Start Up)
├── login.html            # Halaman login (Supabase Auth)
├── akun.html              # Halaman Kelola Akun (khusus Admin)
├── css/
│   └── style.css        # Tema White + Teal
├── js/
│   ├── config.js         # Isi URL & Anon Key Supabase kamu di sini
│   ├── utils.js           # Helper umum (toast, format tanggal, upload foto, role, dst)
│   ├── layout.js          # Sidebar + topbar (hamburger)
│   ├── dashboard.js
│   ├── complaint.js
│   ├── report.js
│   ├── verifikasi.js      # Logic checklist Verifikasi Quality
│   └── akun.js            # Logic Kelola Akun (panggil Edge Function admin-users)
├── assets/
│   └── logo-placeholder.svg   # Logo kosongan, tinggal ganti
└── supabase/
    ├── 01_schema.sql              # Struktur tabel, RLS, storage bucket
    ├── 02_seed_master_data.sql    # Data master Area/Mesin/Equipment/Karyawan
    │                               # (auto-generated dari Karyawan.xlsx & Mesin.xlsx kamu)
    ├── 04_verifikasi_quality.sql  # Tabel verifikasi_quality (checklist After CIP & Start Up)
    ├── 05_akun_admin.sql          # Tabel profiles (role Admin/User) + RLS + trigger
    └── functions/
        └── admin-users/index.ts   # Edge Function CRUD akun (khusus Admin, service role)
```

---

## 2. Setup Supabase (sekali saja)

1. Buat project baru di https://supabase.com/dashboard.
2. Buka **SQL Editor**, jalankan isi file `supabase/01_schema.sql` — ini akan membuat:
   - Tabel master: `master_area`, `master_mesin`, `master_equipment`, `master_karyawan`
   - Tabel transaksi: `complaints`, `qc_reports`
   - Row Level Security (RLS) + storage bucket `qa-photos` untuk foto
3. Jalankan `supabase/02_seed_master_data.sql` — ini akan mengisi:
   - **9 Area**, **103 kombinasi Area-Mesin**, **586 kombinasi Mesin-Equipment** (dari `Mesin.xlsx`)
   - **223 data Karyawan** (dari `Karyawan.xlsx`) — NIK, Nama, Departemen, Status, Gender, Grup (L1/L2/L3), Role
4. Jalankan `supabase/04_verifikasi_quality.sql` — ini membuat tabel `verifikasi_quality` untuk halaman **Verifikasi Quality** (checklist Proses After CIP & Proses Start Up, diambil dari file `01_LAPORAN - Verifikasi Quality.xlsx`).
5. Jalankan `supabase/05_akun_admin.sql` — ini membuat tabel `profiles` (role `Admin`/`User` per akun login) dan mengaktifkan fitur **Kelola Akun**. Lihat bagian [8. Kelola Akun (Admin)](#8-kelola-akun-admin) di bawah untuk langkah selanjutnya (deploy Edge Function + set admin pertama).
6. Buka **Authentication > Users**, klik **Add user** untuk membuat akun login QA pertama (email + password) — atau, kalau sudah setel langkah 5, akun login juga bisa dibuat dari halaman **Kelola Akun** di aplikasi setelah ada 1 admin.
7. Pastikan bucket **qa-photos** muncul di menu **Storage** (dibuat otomatis oleh schema). Kalau tidak muncul, buat manual: nama `qa-photos`, set **Public bucket** = ON.

---

## 3. Hubungkan aplikasi ke Supabase kamu

Buka `js/config.js`, ganti dua baris ini dengan punya kamu (Project Settings > API):

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

---

## 4. Menjalankan aplikasi

Karena ini murni HTML/JS statis, kamu tinggal:

- **Cara termudah:** buka folder ini di VS Code, install extension **Live Server**, klik kanan `login.html` → *Open with Live Server*.
- **Atau:** jalankan `npx serve .` di terminal dari dalam folder `qa-app/`.
- **Atau:** upload semua file ke hosting statis apa pun (Netlify, Vercel, GitHub Pages, cPanel, dsb).

> ⚠️ Jangan dibuka langsung lewat `file://` karena beberapa fitur (fetch, modul) butuh server HTTP.

---

## 5. Fitur yang tersedia

**Dashboard**
- Kartu statistik: total complaint, complaint open, total report QC, QC pass rate 30 hari terakhir
- Grafik tren complaint vs report QC 14 hari terakhir
- Grafik status complaint, complaint per area, hasil QC (pass/fail)
- Tabel complaint & report QC terbaru

**Complaint**
- Tambah/edit/hapus complaint lengkap dengan: tanggal, shift, Area → Mesin → Equipment (dropdown berjenjang), pelapor (dari master karyawan), kategori, tingkat keparahan (severity), deskripsi, tindakan perbaikan, status, dan **upload foto bukti**
- Filter berdasarkan status, severity, area, dan pencarian teks
- Nomor complaint otomatis (format `CMP-2026-0001`, dst)

**Report QC**
- Tambah/edit/hapus report QC dengan: tanggal, shift, Area → Mesin → Equipment, inspector, parameter QC, standar/acuan, hasil aktual, hasil (Pass/Fail), catatan, dan **upload foto**
- Filter berdasarkan hasil, area, dan pencarian teks
- Nomor report otomatis (format `QC-2026-0001`, dst)

**Verifikasi Quality**
- Dua tab: **Proses After CIP** (20 item pengecekan) dan **Proses Start Up** (7 item pengecekan), sesuai template Excel `01_LAPORAN - Verifikasi Quality.xlsx`
- Setiap verifikasi berisi: tanggal, shift, line, opsi per-line, checklist Pengecekan vs Standard (baku, tidak bisa diubah) dengan input Hasil Pengecekan + status **OK / NOK** per item, konfirmasi FLM & QA (dari master karyawan)
- Status keseluruhan otomatis: **Sesuai** (semua item OK) atau **Perlu Tindakan** (ada item NOK)
- Filter berdasarkan shift, status, dan pencarian teks; export ke Excel (per baris = per item checklist)
- Nomor verifikasi otomatis (format `VQ-2026-0001`, dst)

**Kelola Akun (khusus Admin)**
- Menu **"Kelola Akun"** otomatis muncul di sidebar hanya untuk akun dengan role **Admin**
- Tambah akun baru (email + password + nama + role), edit nama/email/password/role, nonaktifkan (ban) / aktifkan kembali, dan hapus akun
- Setiap akun punya role **Admin** atau **User**; sistem mencegah kamu menghapus/menonaktifkan akun sendiri, dan mencegah menghapus/menurunkan Admin terakhir
- Filter berdasarkan role & status (aktif/nonaktif), pencarian nama/email
- Ditenagai oleh Supabase Edge Function `admin-users` (butuh deploy sekali, lihat bagian **8. Kelola Akun (Admin)**)

**Umum**
- Sidebar dengan tombol **hamburger** (collapsible, responsive untuk mobile)
- Logo kosongan di sidebar & halaman login — klik dan simpan logo kamu sendiri lewat kode (`localStorage.setItem('qa_logo', 'data:image/png;base64,...')`) atau ganti langsung file `assets/logo-placeholder.svg`
- Login menggunakan Supabase Auth (email/password)
- Tema **White + Teal**, rapi dan modern, responsif di desktop & mobile

---

## 8. Kelola Akun (Admin)

Fitur ini memungkinkan seorang **Admin** menambah, mengedit, menonaktifkan, dan menghapus akun login langsung dari aplikasi (tanpa buka Supabase Dashboard). Karena membuat/menghapus akun & mengubah password butuh **service role key** (kunci rahasia, beda dari anon key), operasi ini dijalankan lewat **Supabase Edge Function**, bukan langsung dari browser.

### 8.1 Jalankan migrasi SQL
Kalau belum, jalankan `supabase/05_akun_admin.sql` di **SQL Editor**. Ini membuat tabel `profiles` (kolom `role`: `Admin` / `User`), trigger auto-provision profile untuk akun baru, dan RLS.

### 8.2 Deploy Edge Function `admin-users`
Butuh [Supabase CLI](https://supabase.com/docs/guides/cli) terpasang di komputer kamu. Dari dalam folder project ini:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy admin-users
```

Edge Function otomatis punya akses ke `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` (disediakan otomatis oleh Supabase, tidak perlu diisi manual) — kode lengkapnya ada di `supabase/functions/admin-users/index.ts`.

> Kalau function gagal jalan karena env `SUPABASE_ANON_KEY` tidak tersedia otomatis di project kamu, set manual: `supabase secrets set SUPABASE_ANON_KEY=your-anon-key`.

### 8.3 Jadikan akun pertama sebagai Admin
Semua akun baru otomatis dapat role **User**. Untuk membuat Admin pertama (supaya bisa buka halaman "Kelola Akun"), jalankan di **SQL Editor**:

```sql
update profiles set role = 'Admin' where email = 'admin@perusahaan.com';
```

Ganti email dengan akun yang sudah ada di **Authentication > Users**. Setelah itu, login dengan akun tersebut — menu **"Kelola Akun"** akan otomatis muncul di sidebar, dan Admin bisa menambah Admin/User lain lewat aplikasi.

### 8.4 Cara pakai
- Buka menu **Kelola Akun** (hanya terlihat oleh Admin) → **Akun Baru** untuk membuat login baru (email, password, nama, role).
- Klik **Detail** pada baris akun untuk **Edit**, **Nonaktifkan/Aktifkan**, atau **Hapus**.
- Sistem otomatis mencegah kamu menghapus/menonaktifkan akun sendiri, serta mencegah menghapus atau menurunkan role Admin terakhir yang tersisa (supaya tidak ada yang terkunci dari aplikasi).

---

## 9. Menambah logo perusahaan

Cara paling gampang: ganti isi file `assets/logo-placeholder.svg` dengan logo kamu (boleh format `.svg`, `.png`, atau `.jpg` — tinggal sesuaikan nama file di `js/layout.js` dan `login.html`, cari `logo-placeholder.svg`).

---

## 10. Kustomisasi lanjutan

- **Warna tema**: semua warna diatur lewat CSS variable di `css/style.css` bagian `:root` (`--teal-700`, dst) — tinggal ganti nilainya.
- **Kategori complaint / parameter QC**: edit langsung di `complaint.html` dan `report.html` pada bagian `<select>`.
- **Keamanan (RLS)**: policy di `01_schema.sql` saat ini mengizinkan semua user yang login (authenticated) untuk insert/update/delete. Kalau butuh role-based (misal hanya QA yang boleh ubah status), perketat policy tersebut sesuai kebutuhan.
