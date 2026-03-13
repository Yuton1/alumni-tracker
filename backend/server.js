const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcrypt'); // Pastikan sudah di-install

const app = express();
const PORT = 3000;

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(express.json());

// --- KONFIGURASI MySQL ---
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 3306
});

// --- FUNGSI PROFILING ---
function createProfiling(alumni) {
    const parts = alumni.nama ? alumni.nama.split(' ') : [];
    const variasi_nama = [alumni.nama];
    if (parts.length > 1) {
        variasi_nama.push(`${parts[0][0]}. ${parts[parts.length - 1]}`);
        variasi_nama.push(`${parts[parts.length - 1]}, ${parts[0]}`);
    }
    return {
        ...alumni,
        nama_variasi: variasi_nama,
        kata_kunci_afiliasi: ["Universitas Muhammadiyah Malang", "UMM", alumni.prodi || ""],
        kata_kunci_konteks: [alumni.prodi || "", alumni.tahun_lulus ? alumni.tahun_lulus.toString() : "", alumni.kota || ""]
    };
}

// --- API ENDPOINTS ---

// 1. Endpoint Login (Baru)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
        
        const user = results[0];
        const match = (password === user.password);
        
        if (match) {
            res.json({ success: true, role: user.role, userId: user.id });
        } else {
            res.status(401).json({ success: false, message: 'Password salah' });
        }
    });
});

// 2. Statistik
app.get('/api/stats', (req, res) => {
    db.query('SELECT status_pelacakan AS status, COUNT(*) AS count FROM alumnitracking GROUP BY status_pelacakan', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const stats = { 'Teridentifikasi dari sumber publik': 0, 'Perlu Verifikasi Manual': 0, 'Belum ditemukan di sumber publik': 0 };
        rows.forEach(row => { stats[row.status] = row.count; });
        db.query('SELECT COUNT(*) AS total FROM masteralumni', (err2, totalRows) => {
            stats.totalAlumni = totalRows ? totalRows[0].total : 0;
            res.json(stats);
        });
    });
});

// 3. Master Alumni
app.get('/api/master-alumni', (req, res) => {
    const sql = `SELECT m.*, COALESCE(t.status_pelacakan, 'Belum Dilacak') AS status_pelacakan 
                 FROM masteralumni m LEFT JOIN alumnitracking t ON m.id = t.id ORDER BY m.id ASC`;
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(createProfiling));
    });
});

app.get('/api/user/rekap-pekerjaan', (req, res) => {
    // Sesuaikan query ini dengan kebutuhan Anda
    const sql = `SELECT nama_perusahaan, posisi FROM pekerjaan_alumni`;
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 4. Antrean
app.get('/api/antrean', (req, res) => {
    const sql = `SELECT m.*, COALESCE(t.status_pelacakan, 'Belum Dilacak') AS status_pelacakan 
                 FROM masteralumni m LEFT JOIN alumnitracking t ON m.id = t.id 
                 WHERE t.status_pelacakan IS NULL OR t.status_pelacakan IN ('Belum Dilacak', 'Perlu Verifikasi Manual')`;
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(createProfiling));
    });
});

// 5. Tracking
app.post('/api/track/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const status = 'Teridentifikasi dari sumber publik'; 
    const hasil_kandidat = 'Ditemukan via sistem';
    const today = new Date().toISOString().split('T')[0];
    
    const sql = `INSERT INTO alumnitracking (id, status_pelacakan, hasil_kandidat, last_update) 
                 VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status_pelacakan = ?, hasil_kandidat = ?, last_update = ?`;
    db.query(sql, [id, status, hasil_kandidat, today, status, hasil_kandidat, today], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, status });
    });
});

app.get('/api/user/profile-lengkap', (req, res) => {
    const userId = req.query.id;
    // Tambahkan ORDER BY p.id DESC untuk mengambil data yang paling baru dimasukkan
    const sql = `SELECT u.*, m.nama AS nama_lengkap, m.prodi, m.tahun_lulus, m.kota, p.nama_perusahaan, p.posisi 
                 FROM users u 
                 JOIN masteralumni m ON u.alumni_id = m.id 
                 LEFT JOIN pekerjaan_alumni p ON u.id = p.user_id 
                 WHERE u.id = ? 
                 ORDER BY p.id DESC LIMIT 1`; // Ambil hanya yang terbaru

    db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        if (result.length === 0) return res.status(404).json({ message: "Data tidak ditemukan" });
        res.json(result[0]);
    });
});

// --- RUTE STATIS ---
app.use(express.static(path.join(__dirname, '../frontend')));

app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
const multer = require('multer');

// Konfigurasi penyimpanan file
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Batas 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Hanya file gambar yang diperbolehkan!'));
    }
}).single('foto');

// Endpoint Upload Foto
app.post('/api/user/upload-foto', (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        const userId = req.query.id;
        const fotoPath = `/uploads/${req.file.filename}`;
        
        db.query('UPDATE users SET foto_profil = ? WHERE id = ?', [fotoPath, userId], (err) => {
            if (err) return res.status(500).json({ message: 'Gagal update database' });
            res.json({ success: true, path: fotoPath });
        });
    });
});

app.post('/api/user/tambah-pekerjaan', (req, res) => {
    const userId = req.query.id;
    const { nama_perusahaan, posisi } = req.body;

    // Pastikan tabel pekerjaan_alumni memiliki UNIQUE index pada user_id
    const sql = `INSERT INTO pekerjaan_alumni (user_id, nama_perusahaan, posisi) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE nama_perusahaan = VALUES(nama_perusahaan), posisi = VALUES(posisi)`;
    
    db.query(sql, [userId, nama_perusahaan, posisi], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal update' });
        res.json({ success: true });
    });
});

app.post('/api/register', async (req, res) => {
    const { username, password, alumni_id } = req.body;
    
    // 1. Cek duplikat username
    db.query('SELECT id FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error saat cek user' });
        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
        }

        // 2. Query insert yang lebih spesifik
        // Kita hanya mengisi kolom yang diperlukan saja sesuai struktur tabel
        const sql = 'INSERT INTO users (username, password, alumni_id, role) VALUES (?, ?, ?, ?)';
        const values = [username, password, alumni_id, 'mahasiswa'];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("Detail Error SQL:", err); // <--- LIHAT INI DI TERMINAL NODE.JS ANDA
                return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
            }
            res.json({ success: true });
        });
    });
});