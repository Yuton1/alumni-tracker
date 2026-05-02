# alumni-tracker

Nama : Moh AHsan Malik
NIM 202212370311128
Kelas : Rekayasa Kebutuhan A

Sistem pelacakan alumni yang dirancang untuk mengelola profil, riwayat pekerjaan, dan status verifikasi data alumni.

Masuk akun User 
Username : Catur Rahmani Oktavia
Password : 123

Masuk akun Admin
Username : admin
Password : admin123

🔗 Link Akses
- Source Code (GitHub): https://github.com/Yuton1/alumni-tracker.git
- Link Publish : alumni-tracker-production-3af4.up.railway.app

🛠️ Pengembangan Sistem
Aplikasi ini dikembangkan menggunakan arsitektur web dengan stack sebagai berikut:
- Frontend: HTML5, Bootstrap 5, JavaScript (Fetch API)
- Backend: Node.js, Express.js
- Database: MySQL (Laragon)

🧪 Pengujian Kualitas (Testing)
Berikut adalah hasil pengujian aplikasi berdasarkan aspek kualitas yang telah ditentukan pada Daily Project 2:
______________________________________________________________________
|Aspek Kualitas    |    Skenario Pengujian     |     Hasil Pengujian  |
|----------------------------------------------------------------------
|Fungsionalitas    |  User dapat melakukan     | Berhasil (Data       |
|                  |  registrasi dengan data   | tersimpan di DB)     |
|                  |  valid.                   |                      |
|----------------------------------------------------------------------
|Fungsionalitas    | Admin dapat melihat       | Berhasil (Data tampil|
|                  | status verifikasi         | di Dashboard)        |
|                  | alumni                    |                      |
-----------------------------------------------------------------------
| Usability        | Navigasi antara menu      | Berhasil User-       |
|                  | Profile dan Rekap         | friendly  & responsif|
|                  | Pekerjaan                 |                      |
|---------------------------------------------------------------------|
| Reliabilitas     | Sistem menangani input    | Berhasil (Muncul     |
|                  | PID alumni yang tidak     | validasi error)      |
|                  |  terdaftar                |                      |
|---------------------------------------------------------------------|
| Efisiensi        | Waktu akses data rekap    | BCepat (Query < 0    |
|                  | pekerjaan dari databas    | .01 detik)           |
|                  |                           |                      |
|---------------------------------------------------------------------|

Fitur 
✅ Halaman detail profil yang komprehensif
✅ Proses pencarian otomatis ke sumber publik dengan scheduler
✅ Scoring disambiguasi dengan weighting sistem
✅ Cross-validation antar sumber
✅ Jejak bukti lengkap per kandidat
✅ Visual confidence indicators
✅ Timeline verifikasi
✅ Social media integration
✅ Export functionality
✅ Advanced filtering & search


🎓 Alumni Tracker System
Sistem manajemen informasi alumni terintegrasi yang dirancang untuk memantau data profesional, jejak media sosial, dan riwayat akademik lulusan secara otomatis.

🚀 Fitur Utama
Automated Data Cleaning: Memfilter data duplikat dan daftar hitam (staf/dosen) secara otomatis.

Social Media Integration: Pelacakan akun LinkedIn, GitHub, dan Instagram alumni.

SQL Generator: Konversi data CSV alumni langsung menjadi perintah SQL INSERT.

Responsive UI: Antarmuka gelap (Dark Mode) yang intuitif untuk manajemen database.

🛠 Panduan Penggunaan
1. Pendaftaran Akun (Sign Up)
Untuk pengguna baru (Administrator/Staf Jurusan):

Buka aplikasi dan pilih tombol "Register" pada halaman utama.

Masukkan NIP/ID Staff dan Email Institusi.

Verifikasi akun melalui email yang dikirimkan.

Atur kata sandi dan profil departemen (contoh: Informatika UMM).

2. Masuk ke Sistem (Login)
Masukkan Username/Email dan Password yang telah terdaftar.

Sistem menggunakan autentikasi JWT (JSON Web Token) untuk menjaga keamanan sesi Anda.

Klik "Login" untuk masuk ke Dashboard Utama.

3. Import Data Alumni (CSV)
Sistem ini mendukung pengelolaan data massal:

Siapkan file CSV dengan format kolom: id, Nama Lulusan, NIM, Tahun Masuk, Tanggal Lulus, Fakultas, Program Studi.

Masuk ke menu "Import Data".

Unggah file CSV Anda (Sistem akan otomatis menjalankan skrip pembersihan data dari blacklist nama dosen).

Klik "Process" untuk melihat pratinjau data sebelum disimpan ke database.

4. Integrasi Jejak Digital
Untuk menambahkan informasi media sosial alumni:

Pilih salah satu nama alumni dari tabel.

Klik ikon "Edit/Detail".

Masukkan link LinkedIn, GitHub, atau email yang ditemukan.

Klik "Save" untuk memperbarui data di database pusat.

💻 Struktur Database (Contoh SQL)
Data disimpan dengan struktur sebagai berikut:

SQL
CREATE TABLE alumni (
    id INT PRIMARY KEY,
    nama VARCHAR(255),
    nim VARCHAR(20),
    tahun_masuk INT,
    tanggal_lulus DATE,
    fakultas VARCHAR(100),
    program_studi VARCHAR(100),
    linkedin VARCHAR(255),
    email VARCHAR(255)
);
🔧 Pengembangan (Development)
Jika Anda ingin menjalankan proyek ini secara lokal:

Clone Repository:

Bash
git clone https://github.com/username/Alumni-Tracker.git
Install Dependensi:

Bash
npm install  # atau pip install -r requirements.txt
Konfigurasi Environment:
Buat file .env dan masukkan kredensial database (MySQL/TiDB).

📄 Lisensi
Proyek ini dikembangkan untuk kepentingan akademik Universitas Muhammadiyah Malang (UMM).

