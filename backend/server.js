require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'alumni-tracker-secret';

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 4000,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('KONEKSI DATABASE GAGAL:', err.message);
    return;
  }
  console.log('Koneksi Database Berhasil Terhubung!');
  connection.release();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Hanya file gambar yang diperbolehkan!'));
  }
}).single('foto');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak, token tidak ada' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token tidak valid' });
    }
    req.user = user;
    next();
  });
}

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
    kata_kunci_afiliasi: ['Universitas Muhammadiyah Malang', 'UMM', alumni.prodi || ''],
    kata_kunci_konteks: [alumni.prodi || '', alumni.tahun_lulus ? alumni.tahun_lulus.toString() : '', alumni.kota || '']
  };
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

function decodeUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function resolveUserId(req) {
  const queryUserId = Number.parseInt(req.query.id, 10);
  if (!Number.isNaN(queryUserId) && queryUserId > 0) {
    return queryUserId;
  }

  const decoded = decodeUser(req);
  if (decoded && decoded.id) {
    return Number(decoded.id);
  }

  return null;
}

function normalizePekerjaanPayload(payload = {}) {
  return {
    nama_perusahaan: (payload.nama_perusahaan || '').trim(),
    posisi: (payload.posisi || '').trim(),
    jenis_instansi: (payload.jenis_instansi || '').trim(),
    alamat_kerja: (payload.alamat_kerja || '').trim(),
    email_publik: (payload.email_publik || '').trim(),
    no_hp: (payload.no_hp || '').trim(),
    linkedin_url: (payload.linkedin_url || '').trim(),
    ig_url: (payload.ig_url || '').trim(),
    fb_url: (payload.fb_url || '').trim(),
    tiktok_url: (payload.tiktok_url || '').trim(),
    sosmed_kantor: (payload.sosmed_kantor || '').trim()
  };
}

function normalizeFotoProfilPath(rawPath) {
  if (!rawPath) return '';
  const value = String(rawPath).trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/uploads/')) return value;
  if (value.startsWith('uploads/')) return `/${value}`;
  if (value.startsWith('/')) return value;
  return `/uploads/${value}`;
}

// ===== AUTH ENDPOINTS =====

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ success: false, message: 'User tidak ditemukan' });
    }

    const user = results[0];
    const match = password === user.password;

    if (!match) {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      role: user.role,
      userId: user.id,
      username: user.username
    });
  });
});

app.post('/api/register', (req, res) => {
  const { username, password, alumni_id } = req.body;

  console.log(`Mencoba daftar: User=${username}, ID=${alumni_id}`);

  db.query('SELECT id FROM masteralumni WHERE id = ?', [alumni_id], (err, alumniResults) => {
    if (err) {
      console.error('Error Master:', err.message);
      return res.status(500).json({ success: false, message: 'Database error saat cek master' });
    }

    if (alumniResults.length === 0) {
      return res.status(400).json({ success: false, message: 'ID Master Alumni tidak ditemukan!' });
    }

    db.query('SELECT id FROM users WHERE alumni_id = ?', [alumni_id], (idErr, idResults) => {
      if (idErr) {
        return res.status(500).json({ success: false, message: 'Database error saat cek ID alumni' });
      }
      if (idResults.length > 0) {
        return res.status(400).json({ success: false, message: 'ID Alumni ini sudah memiliki akun' });
      }

      db.query('SELECT id FROM users WHERE username = ?', [username], (userErr, userResults) => {
        if (userErr) {
          return res.status(500).json({ success: false, message: 'Database error saat cek username' });
        }
        if (userResults.length > 0) {
          return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
        }

        const sql = 'INSERT INTO users (username, password, alumni_id, role, foto_profil, email, tahun_lulus) VALUES (?, ?, ?, ?, NULL, NULL, NULL)';
        const values = [username, password, alumni_id, 'alumni'];

        db.query(sql, values, (insertErr) => {
          if (insertErr) {
            console.error('GAGAL INSERT:', insertErr.sqlMessage || insertErr.message);
            return res.status(500).json({ success: false, message: `Gagal simpan: ${insertErr.sqlMessage || insertErr.message}` });
          }
          console.log('Registrasi Berhasil!');
          return res.json({ success: true, message: 'Registrasi Berhasil!' });
        });
      });
    });
  });
});

// ===== ADMIN ENDPOINTS =====

app.get('/api/stats', (req, res) => {
  db.query('SELECT status_pelacakan AS status, COUNT(*) AS count FROM alumnitracking GROUP BY status_pelacakan', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const stats = {
      'Teridentifikasi dari sumber publik': 0,
      'Perlu Verifikasi Manual': 0,
      'Belum ditemukan di sumber publik': 0
    };
    rows.forEach((row) => { stats[row.status] = row.count; });
    db.query('SELECT COUNT(*) AS total FROM masteralumni', (err2, totalRows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      stats.totalAlumni = totalRows ? totalRows[0].total : 0;
      res.json(stats);
    });
  });
});

app.get('/api/master-alumni', (req, res) => {
  const sql = `SELECT m.*, COALESCE(t.status_pelacakan, 'Belum Dilacak') AS status_pelacakan
               FROM masteralumni m LEFT JOIN alumnitracking t ON m.id = t.id ORDER BY m.id ASC`;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(createProfiling));
  });
});

app.get('/api/master-alumni/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  
  const sql = `
    SELECT 
      m.id,
      m.nama,
      m.prodi,
      m.fakultas,
      m.kota,
      m.tahun_lulus,
      COALESCE(t.status_pelacakan, 'Belum Dilacak') AS status_pelacakan,
      p.nama_perusahaan, 
      p.posisi, 
      p.jenis_instansi, 
      p.alamat_kerja,
      p.linkedin_url,
      p.ig_url,
      p.fb_url
    FROM masteralumni m 
    LEFT JOIN alumnitracking t ON m.id = t.id 
    LEFT JOIN users u ON m.id = u.alumni_id
    LEFT JOIN pekerjaan_alumni p ON u.id = p.user_id
    WHERE m.id = ?
    ORDER BY p.id DESC
    LIMIT 1`;
  
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Database Error:", err.message);
      return res.status(500).json({ error: "Gagal mengambil data" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Alumni tidak ditemukan' });
    }

    console.log("Data yang dikirim ke Frontend:", results);
    res.json(results); 
  });
});

app.get('/api/antrean', (req, res) => {
  const sql = `SELECT m.*, COALESCE(t.status_pelacakan, 'Belum Dilacak') AS status_pelacakan
               FROM masteralumni m LEFT JOIN alumnitracking t ON m.id = t.id
               WHERE t.status_pelacakan IS NULL OR t.status_pelacakan IN ('Belum Dilacak', 'Perlu Verifikasi Manual')`;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(createProfiling));
  });
});

app.post('/api/track/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const status = 'Teridentifikasi dari sumber publik';
  const hasilKandidat = 'Ditemukan via sistem';
  const today = new Date().toISOString().split('T')[0];

  const sql = `INSERT INTO alumnitracking (id, status_pelacakan, hasil_kandidat, last_update)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 status_pelacakan = ?,
                 hasil_kandidat = ?,
                 last_update = ?`;

  db.query(sql, [id, status, hasilKandidat, today, status, hasilKandidat, today], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, status });
  });
});

app.get('/api/user/profile-lengkap', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User tidak valid. Login ulang diperlukan.' });
  }

  const sql = `
    SELECT
      u.id, u.username, u.role, u.foto_profil, u.alumni_id,
      m.nama AS nama_lengkap, m.prodi, m.tanggal_lulus, m.kota, m.fakultas,
      p.id AS pekerjaan_id,
      p.nama_perusahaan, p.posisi, p.jenis_instansi, p.alamat_kerja,
      p.email_publik, p.no_hp, p.linkedin_url, p.ig_url, p.sosmed_kantor,
      p.fb_url, p.tiktok_url
    FROM users u
    LEFT JOIN masteralumni m ON u.alumni_id = m.id
    LEFT JOIN pekerjaan_alumni p ON u.id = p.user_id
    WHERE u.id = ?
    ORDER BY p.id DESC
    LIMIT 1`;

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error('Database Error:', err);
      return res.status(500).json({ message: 'Gagal mengambil data' });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const profile = result[0];
    profile.foto_profil = normalizeFotoProfilPath(profile.foto_profil);
    return res.json(profile);
  });
});

app.get('/api/user/rekap-pekerjaan', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User tidak valid. Login ulang diperlukan.' });
  }

  const sql = `SELECT
                 id,
                 nama_perusahaan,
                 posisi,
                 jenis_instansi,
                 alamat_kerja,
                 email_publik,
                 no_hp,
                 linkedin_url,
                 ig_url,
                 fb_url,
                 tiktok_url,
                 sosmed_kantor
               FROM pekerjaan_alumni
               WHERE user_id = ?
               ORDER BY id DESC`;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Gagal memuat rekap pekerjaan', error: err.message });
    }
    return res.json(rows);
  });
});

app.post('/api/user/upload-foto', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ message: 'User tidak valid. Login ulang diperlukan.' });
  }

  upload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'File foto belum dipilih.' });

    const fotoPath = `/uploads/${req.file.filename}`;
    db.query('UPDATE users SET foto_profil = ? WHERE id = ?', [fotoPath, userId], (dbErr) => {
      if (dbErr) return res.status(500).json({ message: 'Gagal update database' });
      return res.json({ success: true, path: fotoPath });
    });
  });
});

app.post('/api/user/tambah-pekerjaan', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'User tidak valid. Login ulang diperlukan.' });
  }

  const payload = normalizePekerjaanPayload(req.body);

  const insertSql = `INSERT INTO pekerjaan_alumni
                    (user_id, nama_perusahaan, posisi, jenis_instansi, alamat_kerja, email_publik, no_hp, linkedin_url, ig_url, fb_url, tiktok_url, sosmed_kantor)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const insertValues = [
    userId,
    payload.nama_perusahaan,
    payload.posisi,
    payload.jenis_instansi,
    payload.alamat_kerja,
    payload.email_publik,
    payload.no_hp,
    payload.linkedin_url,
    payload.ig_url,
    payload.fb_url,
    payload.tiktok_url,
    payload.sosmed_kantor
  ];

  db.query(insertSql, insertValues, (insertErr, result) => {
    if (!insertErr) {
      return res.json({ success: true, id: result.insertId, mode: 'insert' });
    }

    if (insertErr.code !== 'ER_DUP_ENTRY') {
      return res.status(500).json({ success: false, message: `Gagal simpan data: ${insertErr.message}` });
    }

    const updateSql = `UPDATE pekerjaan_alumni
                      SET nama_perusahaan = ?,
                          posisi = ?,
                          jenis_instansi = ?,
                          alamat_kerja = ?,
                          email_publik = ?,
                          no_hp = ?,
                          linkedin_url = ?,
                          ig_url = ?,
                          fb_url = ?,
                          tiktok_url = ?,
                          sosmed_kantor = ?
                      WHERE user_id = ?`;

    const updateValues = [
      payload.nama_perusahaan,
      payload.posisi,
      payload.jenis_instansi,
      payload.alamat_kerja,
      payload.email_publik,
      payload.no_hp,
      payload.linkedin_url,
      payload.ig_url,
      payload.fb_url,
      payload.tiktok_url,
      payload.sosmed_kantor,
      userId
    ];

    db.query(updateSql, updateValues, (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ success: false, message: `Gagal update data: ${updateErr.message}` });
      }
      return res.json({ success: true, mode: 'update' });
    });
  });
});

app.put('/api/user/pekerjaan/:id', (req, res) => {
  const userId = resolveUserId(req);
  const pekerjaanId = Number.parseInt(req.params.id, 10);

  if (!userId) {
    return res.status(401).json({ success: false, message: 'User tidak valid. Login ulang diperlukan.' });
  }

  if (Number.isNaN(pekerjaanId) || pekerjaanId <= 0) {
    return res.status(400).json({ success: false, message: 'ID pekerjaan tidak valid.' });
  }

  const payload = normalizePekerjaanPayload(req.body);
  const sql = `UPDATE pekerjaan_alumni
               SET nama_perusahaan = ?,
                   posisi = ?,
                   jenis_instansi = ?,
                   alamat_kerja = ?,
                   email_publik = ?,
                   no_hp = ?,
                   linkedin_url = ?,
                   ig_url = ?,
                   fb_url = ?,
                   tiktok_url = ?,
                   sosmed_kantor = ?
               WHERE id = ? AND user_id = ?`;

  const values = [
    payload.nama_perusahaan,
    payload.posisi,
    payload.jenis_instansi,
    payload.alamat_kerja,
    payload.email_publik,
    payload.no_hp,
    payload.linkedin_url,
    payload.ig_url,
    payload.fb_url,
    payload.tiktok_url,
    payload.sosmed_kantor,
    pekerjaanId,
    userId
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: `Gagal update pekerjaan: ${err.message}` });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Data pekerjaan tidak ditemukan.' });
    }

    return res.json({ success: true });
  });
});

app.delete('/api/user/pekerjaan/:id', (req, res) => {
  const userId = resolveUserId(req);
  const pekerjaanId = Number.parseInt(req.params.id, 10);

  if (!userId) {
    return res.status(401).json({ success: false, message: 'User tidak valid. Login ulang diperlukan.' });
  }

  if (Number.isNaN(pekerjaanId) || pekerjaanId <= 0) {
    return res.status(400).json({ success: false, message: 'ID pekerjaan tidak valid.' });
  }

  db.query('DELETE FROM pekerjaan_alumni WHERE id = ? AND user_id = ?', [pekerjaanId, userId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: `Gagal hapus pekerjaan: ${err.message}` });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Data pekerjaan tidak ditemukan.' });
    }

    return res.json({ success: true });
  });
});

// ===== STATIC FILES & ROUTES =====

// Serve static files
app.use(express.static(path.join(process.cwd(), 'frontend')));

// Specific routes untuk halaman frontend
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/dashboard.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/dashboard.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/user/register.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/user/user.html'));
});

app.get('/user/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/user/Profile/akademik.html'));
});

// Default route
app.get('*', (req, res) => {
  // Abaikan jika ini adalah request API yang salah alamat
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  // Arahkan semua akses halaman ke login.html menggunakan path absolut
  const loginPath = path.join(process.cwd(), 'frontend', 'user', 'login.html');
  
  res.sendFile(loginPath, (err) => {
    if (err) {
      console.error("Gagal mengirim file:", err.message);
      res.status(404).send(`File tidak ditemukan di sistem Vercel. Jalur: ${loginPath}`);
    }
  });
});

// ===== START SERVER =====
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export untuk Vercel
module.exports = app;
