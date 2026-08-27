import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data Directory and File Path for Persistent System Database
const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'system_db.json');

export interface UserAccountRecord {
  username: string;
  password: string;
  name: string;
  role: string;
  department: string;
  email?: string;
  phone?: string;
  nik?: string;
  avatarUrl?: string;
  bio?: string;
  signatureImage?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface SystemConfigRecord {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
    secure: boolean;
    enabled: boolean;
  };
  googleSheetUrl: string;
  eSignApprover: {
    name: string;
    role: string;
    nik: string;
    department: string;
    defaultNote: string;
  };
  jobPositionTargets: {
    LL_FOREMAN: number;
    ASM_SM: number;
    DEPT_MGR_UP: number;
  };
  updatedAt: string;
}

export interface ActivityLogRecord {
  id: string;
  timestamp: string;
  username: string;
  action: 'LOGIN_SUCCESS' | 'PROFILE_UPDATED' | 'PHOTO_UPDATED' | 'PASSWORD_CHANGED' | 'USER_CREATED' | 'USER_DELETED' | 'SETTINGS_SAVED' | 'EMAIL_SENT' | 'PERIOD_DUPLICATED' | 'DATABASE_EXPORTED';
  details: string;
  ip?: string;
}

export interface EmailLogRecord {
  id: string;
  timestamp: string;
  recipient: string;
  cc?: string;
  bcc?: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  messageId: string;
  hasAttachment: boolean;
  status: 'SENT' | 'FAILED';
  previewUrl?: string;
}

export interface SystemDatabaseSchema {
  version: string;
  lastUpdated: string;
  users: UserAccountRecord[];
  config: SystemConfigRecord;
  activityLogs: ActivityLogRecord[];
  emailLogs: EmailLogRecord[];
}

const DEFAULT_INITIAL_DB: SystemDatabaseSchema = {
  version: '2.3',
  lastUpdated: new Date().toISOString(),
  users: [
    {
      username: 'hr_admin',
      password: 'password123',
      name: 'Mahmud Nurdiansyah',
      role: 'HR Development Admin',
      department: 'Human Resources Development',
      email: 'mahmud.nurdiansyah@ajinomoto.co.id',
      phone: '0812-3456-7890',
      nik: 'AJI-HRD-0104',
      avatarUrl: '',
      bio: 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    }
  ],
  config: {
    smtp: {
      host: 'mail.ajinomoto.co.id',
      port: 587,
      user: '',
      pass: '',
      fromName: 'PT Ajinomoto Indonesia — Mojokerto Factory',
      fromEmail: 'noreply@ajinomoto.co.id',
      secure: false,
      enabled: false
    },
    googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1TjJ8d5X9uQ6W8P7K3e2M-Example/pubhtml',
    eSignApprover: {
      name: 'Mahmud Nurdiansyah',
      role: 'HR Development Specialist',
      nik: 'AJI-HRD-0104',
      department: 'Human Resources Development',
      defaultNote: 'Dokumen ini telah ditelaah dan disahkan secara elektronik untuk evaluasi kompetensi keahlian ganda (Multi-Skill) pabrik.'
    },
    jobPositionTargets: {
      LL_FOREMAN: 0.30,
      ASM_SM: 0.30,
      DEPT_MGR_UP: 0.30
    },
    updatedAt: new Date().toISOString()
  },
  activityLogs: [
    {
      id: 'LOG-INIT',
      timestamp: new Date().toISOString(),
      username: 'system',
      action: 'SETTINGS_SAVED',
      details: 'Inisialisasi Database Sistem Multi-Skill Monitoring PT Ajinomoto Indonesia Mojokerto Factory.'
    }
  ],
  emailLogs: []
};

// In-Memory Database Cache
let inMemoryDb: SystemDatabaseSchema | null = null;

// Initialize and ensure database directory and file exist
export function initSystemDatabase(): SystemDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(DEFAULT_INITIAL_DB, null, 2), 'utf-8');
      inMemoryDb = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DB));
      return inMemoryDb!;
    }

    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const parsed: SystemDatabaseSchema = JSON.parse(raw);

    // Validate and merge with defaults if any key is missing
    if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
      parsed.users = DEFAULT_INITIAL_DB.users;
    }
    if (!parsed.config) {
      parsed.config = DEFAULT_INITIAL_DB.config;
    }
    if (!Array.isArray(parsed.activityLogs)) {
      parsed.activityLogs = [];
    }
    if (!Array.isArray(parsed.emailLogs)) {
      parsed.emailLogs = [];
    }

    inMemoryDb = parsed;
    return inMemoryDb;
  } catch (err) {
    console.error('Error initializing system database file, falling back to default:', err);
    inMemoryDb = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DB));
    return inMemoryDb!;
  }
}

// Save Database Atomically
export function persistSystemDatabase(db: SystemDatabaseSchema): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db.lastUpdated = new Date().toISOString();
    inMemoryDb = db;

    // Atomic write via temporary file
    const tempFilePath = `${DB_FILE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFilePath, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFilePath, DB_FILE_PATH);
    return true;
  } catch (err) {
    console.error('Error persisting system database to disk:', err);
    return false;
  }
}

// Get Database State
export function getSystemDatabase(): SystemDatabaseSchema {
  if (!inMemoryDb) {
    return initSystemDatabase();
  }
  return inMemoryDb;
}

// -------------------------------------------------------------
// USER & PROFILING OPERATIONS
// -------------------------------------------------------------
export function getAllUsers(): UserAccountRecord[] {
  const db = getSystemDatabase();
  return db.users;
}

export function getUserByUsername(username: string): UserAccountRecord | null {
  const db = getSystemDatabase();
  const found = db.users.find(
    (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase()
  );
  return found || null;
}

export function authenticateUser(username: string, password: string): { success: boolean; message?: string; user?: UserAccountRecord } {
  const db = getSystemDatabase();
  const user = db.users.find(
    (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase() && u.password === password
  );

  if (!user) {
    return { success: false, message: 'Username atau password salah. Silakan coba lagi.' };
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  addActivityLog(user.username, 'LOGIN_SUCCESS', `Login berhasil ke sistem dari ${user.role} (${user.department})`);
  persistSystemDatabase(db);

  return { success: true, user };
}

export function updateUserProfile(
  targetUsername: string,
  updates: Partial<UserAccountRecord>,
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  const db = getSystemDatabase();
  const index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
  );

  if (index === -1) {
    return { success: false, message: 'Akun administrator tidak ditemukan di database server.' };
  }

  const current = db.users[index];

  // Check username uniqueness if changing username
  if (updates.username && updates.username.trim().toLowerCase() !== targetUsername.trim().toLowerCase()) {
    const isTaken = db.users.some(
      (u, idx) => idx !== index && u.username.trim().toLowerCase() === updates.username!.trim().toLowerCase()
    );
    if (isTaken) {
      return { success: false, message: `Username "${updates.username}" telah digunakan oleh akun lain.` };
    }
  }

  const updatedUser: UserAccountRecord = {
    ...current,
    ...updates,
    username: updates.username?.trim() || current.username,
    name: updates.name?.trim() || current.name,
    role: updates.role?.trim() || current.role,
    department: updates.department?.trim() || current.department,
    email: updates.email?.trim() || current.email,
    phone: updates.phone?.trim() || current.phone,
    nik: updates.nik?.trim() || current.nik,
    bio: updates.bio !== undefined ? updates.bio : current.bio,
    avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl,
    signatureImage: updates.signatureImage !== undefined ? updates.signatureImage : current.signatureImage,
    updatedAt: new Date().toISOString()
  };

  db.users[index] = updatedUser;

  // Log action
  const hasAvatarChange = updates.avatarUrl !== undefined && updates.avatarUrl !== current.avatarUrl;
  addActivityLog(
    updatedUser.username,
    hasAvatarChange ? 'PHOTO_UPDATED' : 'PROFILE_UPDATED',
    `Memperbarui data profil: ${updatedUser.name} (${updatedUser.role} - ${updatedUser.department})${hasAvatarChange ? ' beserta foto profil' : ''}`,
    ip
  );

  persistSystemDatabase(db);
  return { success: true, message: 'Profil dan foto pengguna berhasil diperbarui di database server.', user: updatedUser };
}

export function updateUserPhoto(
  username: string,
  avatarUrl: string,
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  return updateUserProfile(username, { avatarUrl }, ip);
}

export function removeUserPhoto(
  username: string,
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  return updateUserProfile(username, { avatarUrl: '' }, ip);
}

export function changeUserPassword(
  username: string,
  oldPw: string,
  newPw: string,
  ip?: string
): { success: boolean; message: string } {
  const db = getSystemDatabase();
  const index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase()
  );

  if (index === -1) {
    return { success: false, message: 'Akun pengguna tidak ditemukan di database server.' };
  }

  if (db.users[index].password !== oldPw) {
    return { success: false, message: 'Kata sandi lama tidak sesuai.' };
  }

  if (!newPw || newPw.length < 6) {
    return { success: false, message: 'Kata sandi baru minimal 6 karakter.' };
  }

  db.users[index].password = newPw;
  db.users[index].updatedAt = new Date().toISOString();

  addActivityLog(username, 'PASSWORD_CHANGED', `Mengganti kata sandi akun ${username}`, ip);
  persistSystemDatabase(db);

  return { success: true, message: 'Kata sandi akun berhasil diperbarui di database server.' };
}

export function createNewUser(
  newUser: Omit<UserAccountRecord, 'createdAt' | 'updatedAt'>,
  creatorUsername: string = 'system',
  ip?: string
): { success: boolean; message: string; user?: UserAccountRecord } {
  const db = getSystemDatabase();
  const exists = db.users.some(
    (u) => u.username.trim().toLowerCase() === newUser.username.trim().toLowerCase()
  );

  if (exists) {
    return { success: false, message: `Username "${newUser.username}" sudah terdaftar.` };
  }

  const record: UserAccountRecord = {
    ...newUser,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(record);
  addActivityLog(creatorUsername, 'USER_CREATED', `Membuat akun pengguna baru: ${record.username} (${record.name})`, ip);
  persistSystemDatabase(db);

  return { success: true, message: `Akun ${record.name} berhasil ditambahkan ke database server.`, user: record };
}

export function deleteUser(
  targetUsername: string,
  removerUsername: string = 'system',
  ip?: string
): { success: boolean; message: string } {
  const db = getSystemDatabase();
  if (targetUsername.trim().toLowerCase() === 'hr_admin') {
    return { success: false, message: 'Akun Super Administrator utama (hr_admin) tidak dapat dihapus.' };
  }

  const index = db.users.findIndex(
    (u) => u.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
  );

  if (index === -1) {
    return { success: false, message: 'Pengguna tidak ditemukan.' };
  }

  const deleted = db.users.splice(index, 1)[0];
  addActivityLog(removerUsername, 'USER_DELETED', `Menghapus akun pengguna: ${deleted.username} (${deleted.name})`, ip);
  persistSystemDatabase(db);

  return { success: true, message: `Akun ${deleted.name} berhasil dihapus dari database server.` };
}

// -------------------------------------------------------------
// SYSTEM CONFIGURATION OPERATIONS
// -------------------------------------------------------------
export function getSystemConfig(): SystemConfigRecord {
  const db = getSystemDatabase();
  return db.config;
}

export function updateSystemConfig(
  updates: Partial<SystemConfigRecord>,
  username: string = 'system',
  ip?: string
): { success: boolean; message: string; config: SystemConfigRecord } {
  const db = getSystemDatabase();
  db.config = {
    ...db.config,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  addActivityLog(username, 'SETTINGS_SAVED', 'Memperbarui konfigurasi sistem terpusat (SMTP/Sync/E-Sign)', ip);
  persistSystemDatabase(db);

  return { success: true, message: 'Konfigurasi sistem berhasil disimpan di database server.', config: db.config };
}

// -------------------------------------------------------------
// ACTIVITY & AUDIT LOG OPERATIONS
// -------------------------------------------------------------
export function addActivityLog(
  username: string,
  action: ActivityLogRecord['action'],
  details: string,
  ip?: string
): ActivityLogRecord {
  const db = getSystemDatabase();
  const log: ActivityLogRecord = {
    id: `ACT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    username,
    action,
    details,
    ip
  };

  db.activityLogs.unshift(log);
  // Cap at 250 recent activity logs
  if (db.activityLogs.length > 250) {
    db.activityLogs = db.activityLogs.slice(0, 250);
  }

  return log;
}

export function getActivityLogs(limit: number = 50): ActivityLogRecord[] {
  const db = getSystemDatabase();
  return db.activityLogs.slice(0, limit);
}

// -------------------------------------------------------------
// EMAIL DISPATCH LOG OPERATIONS
// -------------------------------------------------------------
export function addEmailLog(logData: Omit<EmailLogRecord, 'id' | 'timestamp'>): EmailLogRecord {
  const db = getSystemDatabase();
  const log: EmailLogRecord = {
    id: `EML-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...logData
  };

  db.emailLogs.unshift(log);
  // Cap at 200 email logs
  if (db.emailLogs.length > 200) {
    db.emailLogs = db.emailLogs.slice(0, 200);
  }

  persistSystemDatabase(db);
  return log;
}

export function getEmailLogs(limit: number = 50): EmailLogRecord[] {
  const db = getSystemDatabase();
  return db.emailLogs.slice(0, limit);
}
