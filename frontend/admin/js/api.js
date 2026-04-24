/**
 * File: js/api-config.js
 * Konfigurasi API yang sudah disesuaikan dengan endpoint di server.js
 * Backend: C:\laragon\www\alumni-tracker\backend\server.js
 */

// ===== CONFIGURATION =====
const API_CONFIG = {
  BASE_URL: "https://alumni-tracker-xi.vercel.app",
  TIMEOUT: 10000
};

// ===== ENDPOINTS (Dari server.js) =====
const ENDPOINTS = {
  // Auth
  LOGIN: '/api/login',
  REGISTER: '/api/register',
  
  // Stats & Admin
  STATS: '/api/stats',
  ANTREAN: '/api/antrean',
  MASTER_ALUMNI: '/api/master-alumni',
  TRACK: '/api/track',
  TRACKING_WORKBENCH: '/api/admin/tracking-workbench',
  
  // User Profile (Alumni)
  USER_PROFILE: '/api/user/profile-lengkap',
  USER_PEKERJAAN: '/api/user/rekap-pekerjaan',
  USER_UPLOAD_FOTO: '/api/user/upload-foto',
  USER_TAMBAH_PEKERJAAN: '/api/user/tambah-pekerjaan',
  USER_UPDATE_PEKERJAAN: '/api/user/pekerjaan',
  USER_DELETE_PEKERJAAN: '/api/user/pekerjaan'
};

// ===== HEADERS HELPER =====
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// ===== FETCH WRAPPER =====
async function apiRequest(endpoint, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  const config = {
    method: options.method || 'GET',
    headers: getAuthHeaders(),
    ...options
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    const response = await fetch(url, {
      ...config,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('Sesi berakhir. Silakan login ulang.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error: ${response.status}`);
    }

    return data;

  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ===== AUTH HANDLER =====
function handleUnauthorized() {
  localStorage.clear();
  setTimeout(() => {
    window.location.replace('/login.html');
  }, 500);
}

function requireAdminAccess() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const role = localStorage.getItem('role');
  
  if (!isLoggedIn || role !== 'admin') {
    handleUnauthorized();
    return false;
  }
  
  return true;
}

// ===== ADMIN APIs =====

/**
 * Get statistics dari semua alumni
 * Endpoint: GET /api/stats
 */
async function getStats() {
  return await apiRequest(ENDPOINTS.STATS);
}

/**
 * Get antrean pelacakan (alumni yang belum ditrack)
 * Endpoint: GET /api/antrean
 */
async function getAntrean() {
  return await apiRequest(ENDPOINTS.ANTREAN);
}

/**
 * Get master alumni (semua alumni)
 * Endpoint: GET /api/master-alumni
 */
async function getMasterAlumni() {
  return await apiRequest(ENDPOINTS.MASTER_ALUMNI);
}

/**
 * Track alumni by ID
 * Endpoint: POST /api/track/{id}
 */
async function trackAlumni(alumniId) {
  return await apiRequest(`${ENDPOINTS.TRACK}/${alumniId}`, {
    method: 'POST'
  });
}

/**
 * Get detail master alumni by ID
 * Endpoint: GET /api/master-alumni/{id}
 */
async function getMasterAlumniDetail(alumniId) {
  return await apiRequest(`${ENDPOINTS.MASTER_ALUMNI}/${alumniId}`);
}

async function getTrackingWorkbench(page = 1, limit = 10) {
  return await apiRequest(`${ENDPOINTS.TRACKING_WORKBENCH}?page=${page}&limit=${limit}`);
}

async function getTrackingWorkbenchDetail(alumniId) {
  return await apiRequest(`${ENDPOINTS.TRACKING_WORKBENCH}/${alumniId}`);
}

// ===== USER/ALUMNI APIs =====

/**
 * Login user
 * Endpoint: POST /api/login
 */
async function login(username, password) {
  return await apiRequest(ENDPOINTS.LOGIN, {
    method: 'POST',
    body: { username, password }
  });
}

/**
 * Register user
 * Endpoint: POST /api/register
 */
async function register(username, password, alumni_id) {
  return await apiRequest(ENDPOINTS.REGISTER, {
    method: 'POST',
    body: { username, password, alumni_id }
  });
}

/**
 * Get user profile lengkap (dengan pekerjaan)
 * Endpoint: GET /api/user/profile-lengkap
 */
async function getUserProfile() {
  return await apiRequest(ENDPOINTS.USER_PROFILE);
}

/**
 * Get user pekerjaan history
 * Endpoint: GET /api/user/rekap-pekerjaan
 */
async function getUserPekerjaan() {
  return await apiRequest(ENDPOINTS.USER_PEKERJAAN);
}

/**
 * Upload user foto profil
 * Endpoint: POST /api/user/upload-foto
 */
async function uploadFotoProfil(file) {
  const formData = new FormData();
  formData.append('foto', file);

  const url = `${API_CONFIG.BASE_URL}${ENDPOINTS.USER_UPLOAD_FOTO}`;
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!response.ok) {
    throw new Error('Gagal upload foto');
  }

  return await response.json();
}

/**
 * Add/Update pekerjaan alumni
 * Endpoint: POST /api/user/tambah-pekerjaan
 */
async function tambahPekerjaan(pekerjaanData) {
  return await apiRequest(ENDPOINTS.USER_TAMBAH_PEKERJAAN, {
    method: 'POST',
    body: pekerjaanData
  });
}

/**
 * Update pekerjaan by ID
 * Endpoint: PUT /api/user/pekerjaan/{id}
 */
async function updatePekerjaan(pekerjaanId, pekerjaanData) {
  return await apiRequest(`${ENDPOINTS.USER_UPDATE_PEKERJAAN}/${pekerjaanId}`, {
    method: 'PUT',
    body: pekerjaanData
  });
}

/**
 * Delete pekerjaan by ID
 * Endpoint: DELETE /api/user/pekerjaan/{id}
 */
async function deletePekerjaan(pekerjaanId) {
  return await apiRequest(`${ENDPOINTS.USER_DELETE_PEKERJAAN}/${pekerjaanId}`, {
    method: 'DELETE'
  });
}

// ===== EXPORT =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_CONFIG,
    ENDPOINTS,
    apiRequest,
    getStats,
    getAntrean,
    getMasterAlumni,
    trackAlumni,
    getMasterAlumniDetail,
    getTrackingWorkbench,
    getTrackingWorkbenchDetail,
    login,
    register,
    getUserProfile,
    getUserPekerjaan,
    uploadFotoProfil,
    tambahPekerjaan,
    updatePekerjaan,
    deletePekerjaan,
    requireAdminAccess,
    handleUnauthorized
  };
}
