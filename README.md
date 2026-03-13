# alumni-tracker

Nama : Moh AHsan Malik
NIM 202212370311128
Kelas : Rekayasa Kebutuhan A

Sistem pelacakan alumni yang dirancang untuk mengelola profil, riwayat pekerjaan, dan status verifikasi data alumni.

akun Admin
Username : admin
Password : admin123

akun Mahasiswa 
Username : Siti 123
Password : 12345678

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
|  Kegunaan        | Navigasi menu dashboard   | Pengguna dapat       |
|                  |                           | berpindah antar menu |
|                  |                           |                      |
|---------------------------------------------------------------------|
| Efisiensi        | Waktu akses data rekap    | BCepat (Query < 0    |
|                  | pekerjaan dari databas    | .01 detik)           |
|                  |                           |                      |
|---------------------------------------------------------------------|

Pengujian menggunakan lighthouse :
Aplikasi pelacakan alumni yang dibangun dengan performa tinggi dan aksesibilitas maksimal.

Status Proyek
⚠️ Status: Dalam tahap pengembangan aktif / perbaikan deployment.
(Catatan: Saat ini sedang dilakukan optimalisasi routing dan perbaikan infinite redirect pada sisi klien).

Mengapa Alumni Tracker?
mengutamakan pengalaman pengguna dengan performa yang dioptimalkan. Berikut adalah hasil audit Lighthouse terbaru:

|---------------------------------------------------------------------|
|               Metric                 |           Score              |
|---------------------------------------------------------------------|
|             Performance              |             93               |
|---------------------------------------------------------------------|
|             Accessibility            |             97               |
|---------------------------------------------------------------------|
|            Best Practices            |             96               |
|---------------------------------------------------------------------|
|                 SEO                  |             82               |
|---------------------------------------------------------------------|
