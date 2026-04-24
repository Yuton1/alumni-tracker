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
const allowedOrigins = [
  "https://alumni-tracker-xi.vercel.app",
  "https://alumni-tracker.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

app.use(cors({
  origin: [
    "https://alumni-tracker-xi.vercel.app",
    "https://alumni-tracker-2glr1b8cy-maliks-projects-1fd561e1.vercel.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 4000,
  ssl: {
    rejectUnauthorized: false
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

  if (!authHeader) {
    return res.status(401).json({
      message: 'Akses ditolak, token tidak ada'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'Token tidak valid'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: 'Token tidak valid'
      });
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
    tahun_mulai: payload.tahun_mulai || null,
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

function formatDisplayDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function generateSearchQueries(alumni) {
  const nama = alumni.nama || '';
  const prodi = alumni.prodi || '';
  const fakultas = alumni.fakultas || '';
  const kota = alumni.kota || '';
  const tahun = alumni.tahun_lulus ? String(alumni.tahun_lulus) : '';
  const variasi = Array.isArray(alumni.nama_variasi) ? alumni.nama_variasi : [nama];

  return Array.from(new Set([
    `"${nama}" "${prodi}"`,
    `"${nama}" "${fakultas}"`,
    `"${nama}" "${kota}"`,
    `"${nama}" "${tahun}"`,
    `"${nama}" site:linkedin.com/in`,
    `"${nama}" site:scholar.google.com`,
    `"${nama}" site:orcid.org`,
    `"${nama}" site:researchgate.net`,
    `"${nama}" site:instagram.com`,
    `"${nama}" site:facebook.com`,
    ...variasi.map((variasiNama) => `"${variasiNama}" "${prodi}"`)
  ].filter(Boolean)));
}

function collapseTrackingRows(rows) {
  const byId = new Map();

  rows.forEach((row) => {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, { ...row });
      return;
    }

    const existingWorkId = Number(existing.pekerjaan_id || 0);
    const nextWorkId = Number(row.pekerjaan_id || 0);
    if (nextWorkId >= existingWorkId) {
      byId.set(row.id, { ...existing, ...row });
    }
  });

  return Array.from(byId.values());
}

function buildTrackingWorkbenchItem(row) {
  const profile = createProfiling(row);
  const socialSources = [
    row.linkedin_url ? { label: 'LinkedIn', url: row.linkedin_url } : null,
    row.ig_url ? { label: 'Instagram', url: row.ig_url } : null,
    row.fb_url ? { label: 'Facebook', url: row.fb_url } : null,
    row.tiktok_url ? { label: 'TikTok', url: row.tiktok_url } : null
  ].filter(Boolean);

  const validationSources = [
    'Master Alumni',
    row.nama_perusahaan ? 'Pekerjaan' : null,
    ...socialSources.map((source) => source.label),
    row.email_publik ? 'Email Publik' : null,
    row.no_hp ? 'No HP' : null
  ].filter(Boolean);

  const scoreParts = [
    row.nama ? 14 : 0,
    row.prodi ? 8 : 0,
    row.fakultas ? 6 : 0,
    row.kota ? 8 : 0,
    row.tahun_lulus ? 8 : 0,
    row.nama_perusahaan ? 16 : 0,
    row.posisi ? 10 : 0,
    row.jenis_instansi ? 6 : 0,
    row.alamat_kerja ? 6 : 0,
    row.email_publik ? 5 : 0,
    row.no_hp ? 5 : 0,
    socialSources.length * 4,
    row.status_pelacakan === 'Teridentifikasi dari sumber publik' ? 8 : 0
  ];

  const confidenceScore = Math.min(98, scoreParts.reduce((sum, value) => sum + value, 0));
  const confidenceLabel = confidenceScore >= 75 ? 'Tinggi' : confidenceScore >= 45 ? 'Sedang' : 'Rendah';
  const validationLevel = validationSources.length >= 4 ? 'Lulus cross-validation' : validationSources.length >= 2 ? 'Perlu verifikasi manual' : 'Belum cukup bukti';

  const evidence = [
    {
      source: 'Master Alumni',
      title: `Profil ${row.nama || 'alumni'}`,
      snippet: `${row.prodi || '-'} | ${row.fakultas || '-'} | ${row.kota || '-'} | Lulus ${row.tahun_lulus || '-'}`,
      link: `/admin/detailprofile.html?id=${row.id}`,
      waktu: formatDisplayDate(row.last_update || new Date()),
      score: 20
    },
    row.nama_perusahaan ? {
      source: 'Pekerjaan Terbaru',
      title: row.nama_perusahaan,
      snippet: `${row.posisi || '-'} di ${row.nama_perusahaan}. ${row.jenis_instansi || '-'} | ${row.alamat_kerja || '-'}`,
      link: `/admin/detailprofile.html?id=${row.id}`,
      waktu: formatDisplayDate(row.last_update || new Date()),
      score: 18
    } : null,
    row.linkedin_url ? {
      source: 'LinkedIn',
      title: 'Tautan LinkedIn terdeteksi',
      snippet: row.linkedin_url,
      link: row.linkedin_url,
      waktu: formatDisplayDate(row.last_update || new Date()),
      score: 16
    } : null,
    row.ig_url ? {
      source: 'Instagram',
      title: 'Tautan Instagram terdeteksi',
      snippet: row.ig_url,
      link: row.ig_url,
      waktu: formatDisplayDate(row.last_update || new Date()),
      score: 12
    } : null,
    row.fb_url ? {
      source: 'Facebook',
      title: 'Tautan Facebook terdeteksi',
      snippet: row.fb_url,
      link: row.fb_url,
      waktu: formatDisplayDate(row.last_update || new Date()),
      score: 12
    } : null,
    row.tiktok_url ? {
      source: 'TikTok',
      title: 'Tautan TikTok terdeteksi',
      snippet: row.tiktok_url,
      link: row.tiktok_url,
      waktu: formatDisplayDate(row.last_update || new Date()),
      score: 12
    } : null
  ].filter(Boolean);

  const statusPelacakan = row.status_pelacakan || 'Belum Dilacak';
  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 7);

  return {
    ...profile,
    foto_profil: normalizeFotoProfilPath(row.foto_profil),
    status_pelacakan: statusPelacakan,
    hasil_kandidat: row.hasil_kandidat || (row.nama_perusahaan ? `${row.posisi || 'Profesional'} di ${row.nama_perusahaan}` : 'Belum ada hasil kandidat'),
    last_update: row.last_update || null,
    scheduler: {
      job_name: 'Pelacakan Alumni Publik',
      cadence: 'Mingguan',
      last_run: row.last_update ? formatDisplayDate(row.last_update) : 'Belum pernah dijalankan',
      next_run: formatDisplayDate(nextRun),
      queue_state: statusPelacakan === 'Belum Dilacak' ? 'Siap diproses' : 'Perlu pembaruan berkala'
    },
    scoring: {
      score: confidenceScore,
      label: confidenceLabel,
      category: confidenceScore >= 75 ? 'Kemungkinan kuat' : confidenceScore >= 45 ? 'Perlu verifikasi' : 'Tidak cocok'
    },
    validation: {
      sources: validationSources,
      count: validationSources.length,
      level: validationLevel
    },
    search_queries: generateSearchQueries(profile),
    evidence
  };
}

function respondWithTrackingWorkbench(req, res, rows) {
  const page = Math.max(Number.parseInt(req.query.page || '1', 10) || 1, 1);
  const limitRaw = Number.parseInt(req.query.limit || '10', 10) || 10;
  const limit = Math.min(Math.max(limitRaw, 1), 10);
  const items = collapseTrackingRows(rows).map(buildTrackingWorkbenchItem);
  const total = items.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const pagedItems = items.slice(start, start + limit);

  const summary = {
    total,
    totalPages,
    page: safePage,
    limit,
    scheduler: {
      name: 'Pelacakan Alumni Publik',
      status: total ? 'Aktif' : 'Menunggu data',
      cadence: 'Mingguan'
    },
    counts: {
      tinggi: items.filter((item) => item.scoring.score >= 75).length,
      sedang: items.filter((item) => item.scoring.score >= 45 && item.scoring.score < 75).length,
      rendah: items.filter((item) => item.scoring.score < 45).length
    }
  };

  res.json({
    summary,
    items: pagedItems
  });
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
      COALESCE(t.hasil_kandidat, '') AS hasil_kandidat,
      t.last_update,
      u.foto_profil,
      p.nama_perusahaan, 
      p.posisi, 
      p.jenis_instansi, 
      p.alamat_kerja,
      p.email_publik,
      p.no_hp,
      p.linkedin_url,
      p.ig_url,
      p.fb_url,
      p.tiktok_url,
      p.sosmed_kantor
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
    res.json(results.map((row) => ({
      ...row,
      foto_profil: normalizeFotoProfilPath(row.foto_profil)
    }))); 
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

app.get('/api/admin/tracking-workbench', authenticateToken, (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Akses admin ditolak' });
  }

  const sql = `
    SELECT
      m.id,
      m.nama,
      m.prodi,
      m.fakultas,
      m.kota,
      m.tahun_lulus,
      u.foto_profil,
      p.id AS pekerjaan_id,
      p.nama_perusahaan,
      p.posisi,
      p.jenis_instansi,
      p.alamat_kerja,
      p.email_publik,
      p.no_hp,
      p.linkedin_url,
      p.ig_url,
      p.fb_url,
      p.tiktok_url,
      p.sosmed_kantor,
      COALESCE(t.status_pelacakan, 'Belum Dilacak') AS status_pelacakan,
      COALESCE(t.hasil_kandidat, '') AS hasil_kandidat,
      t.last_update
    FROM masteralumni m
    LEFT JOIN alumnitracking t ON m.id = t.id
    LEFT JOIN users u ON m.id = u.alumni_id
    LEFT JOIN pekerjaan_alumni p ON u.id = p.user_id
    ORDER BY m.id ASC, p.id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Gagal memuat tracking workbench', error: err.message });
    }

    return respondWithTrackingWorkbench(req, res, rows);
  });
});

app.get('/api/admin/tracking-workbench/:id', authenticateToken, (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Akses admin ditolak' });
  }

  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ message: 'ID alumni tidak valid' });
  }

  const sql = `
    SELECT
      m.id,
      m.nama,
      m.prodi,
      m.fakultas,
      m.kota,
      m.tahun_lulus,
      u.foto_profil,
      p.id AS pekerjaan_id,
      p.nama_perusahaan,
      p.posisi,
      p.jenis_instansi,
      p.alamat_kerja,
      p.email_publik,
      p.no_hp,
      p.linkedin_url,
      p.ig_url,
      p.fb_url,
      p.tiktok_url,
      p.sosmed_kantor,
      COALESCE(t.status_pelacakan, 'Belum Dilacak') AS status_pelacakan,
      COALESCE(t.hasil_kandidat, '') AS hasil_kandidat,
      t.last_update
    FROM masteralumni m
    LEFT JOIN alumnitracking t ON m.id = t.id
    LEFT JOIN users u ON m.id = u.alumni_id
    LEFT JOIN pekerjaan_alumni p ON u.id = p.user_id
    WHERE m.id = ?
    ORDER BY p.id DESC
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Gagal memuat detail tracking', error: err.message });
    }

    if (!rows.length) {
      return res.status(404).json({ message: 'Alumni tidak ditemukan' });
    }

    const [latest] = collapseTrackingRows(rows);
    return res.json(buildTrackingWorkbenchItem(latest));
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
                 tahun_mulai,
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
                     (user_id, nama_perusahaan, posisi, tahun_mulai, jenis_instansi, alamat_kerja, email_publik, no_hp, linkedin_url, ig_url, fb_url, tiktok_url, sosmed_kantor) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const insertValues = [
    userId,
    payload.nama_perusahaan,
    payload.posisi,
    payload.tahun_mulai,
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
                          tahun_mulai = ?,
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
                   tahun_mulai = ?,
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
    payload.tahun_mulai,
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
// haloo ini percobaan deploy sekarang

const frontendPath = path.resolve(process.cwd(), 'frontend');

// 2. Sajikan file statis (CSS, JS, Gambar)
app.use(express.static(frontendPath));

// 3. Rute manual untuk halaman utama aplikasi kamu
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin/dashboard.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin/dashboard.html'));
});

app.get('/admin/tracking-engine', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin/tracking-engine.html'));
});

app.get('/admin/detailprofile', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin/detailprofile.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(frontendPath, 'register.html'));
});

app.get('/user', (req, res) => {
  res.sendFile(path.join(frontendPath, 'user/user.html'));
});

app.get('/user/profile', (req, res) => {
  // Pastikan 'Profile' menggunakan P besar jika foldermu memang "Profile"
  res.sendFile(path.join(frontendPath, 'user/Profile/akademik.html'));
});

app.get('/api/healthcheck', async (req, res) => {
  try {
    // Sesuaikan 'db' dengan nama variabel koneksi database kamu
    // Contoh untuk MySQL/TiDB:
    await db.query('SELECT 1'); 
    res.json({ status: 'Connected', message: 'Database aman, Malik!' });
  } catch (err) {
    res.status(500).json({ status: 'Error', message: err.message });
  }
});

// ===== START SERVER =====
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

module.exports = app;
