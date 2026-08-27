import { UserAccount, UserSession, SystemConfig, ActivityLog, EmailLog } from '../types';

export interface SystemInitData {
  users: UserAccount[];
  config: SystemConfig;
  recentLogs: ActivityLog[];
  emailLogs: EmailLog[];
}

/**
 * Safely parse JSON from response, preventing "Unexpected token ... is not valid JSON" errors
 */
async function safeParseJson<T = any>(res: Response, fallbackMessage: string): Promise<{ ok: boolean; data: T | null; message: string }> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const parsed = await res.json();
      return {
        ok: res.ok,
        data: parsed,
        message: parsed?.message || (res.ok ? 'Sukses' : fallbackMessage)
      };
    }
    // If server returned text/html (e.g. 404 or Vite proxying during startup)
    const text = await res.text();
    console.warn(`Non-JSON response (${res.status}):`, text.slice(0, 120));
    return {
      ok: false,
      data: null,
      message: res.ok ? 'Format data respons tidak valid.' : (fallbackMessage || `Server merespons status ${res.status}`)
    };
  } catch (err: any) {
    return {
      ok: false,
      data: null,
      message: err?.message || fallbackMessage
    };
  }
}

/**
 * Fetch all initial persistent system database data from server.
 * This guarantees that when a user opens Incognito mode, another tab, or another device,
 * the latest profiles, avatars, settings, and users are completely synced.
 */
export async function fetchSystemInit(): Promise<SystemInitData | null> {
  try {
    const res = await fetch('/api/system/init');
    const { ok, data } = await safeParseJson<{ success: boolean; users?: UserAccount[]; config: SystemConfig; recentLogs?: ActivityLog[]; emailLogs?: EmailLog[] }>(
      res,
      'Gagal memuat data sistem'
    );
    if (ok && data?.success) {
      return {
        users: data.users || [],
        config: data.config,
        recentLogs: data.recentLogs || [],
        emailLogs: data.emailLogs || []
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch system init data from backend:', err);
    return null;
  }
}

/**
 * Update user profile and photo on server database
 */
export async function updateServerUserProfile(
  username: string,
  updatedData: Partial<UserAccount>
): Promise<{ success: boolean; message: string; user?: UserAccount; session?: UserSession }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const { ok, data, message } = await safeParseJson<{
      success: boolean;
      message: string;
      user?: UserAccount;
      session?: UserSession;
    }>(res, 'Gagal memperbarui profil di server database.');

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Profil berhasil disimpan.' : 'Gagal menyimpan profil ke server.')
    };
  } catch (err: any) {
    console.error('Error updating profile on server:', err);
    return {
      success: false,
      message: err?.message || 'Gagal terhubung ke server database.'
    };
  }
}

/**
 * Update user photo avatar on server database
 */
export async function updateServerUserPhoto(
  username: string,
  avatarUrl: string
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal menyimpan foto ke server database.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Foto profil berhasil disimpan.' : 'Gagal menyimpan foto ke server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menyimpan foto ke server database.'
    };
  }
}

/**
 * Remove user avatar photo on server database
 */
export async function removeServerUserPhoto(
  username: string
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/avatar`, {
      method: 'DELETE'
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal menghapus foto di server database.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Foto profil berhasil dihapus.' : 'Gagal menghapus foto di server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menghapus foto di server database.'
    };
  }
}

/**
 * Authenticate login against server database
 */
export async function serverLogin(
  username: string,
  password: string
): Promise<{ success: boolean; message?: string; session?: UserSession; user?: UserAccount }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const { ok, data, message } = await safeParseJson<{
      success: boolean;
      message?: string;
      session?: UserSession;
      user?: UserAccount;
    }>(res, 'Gagal memverifikasi login ke server.');

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || 'Gagal menghubungi server otentikasi.'
    };
  } catch (err: any) {
    console.error('Server login error:', err);
    return {
      success: false,
      message: 'Gagal menghubungi server otentikasi.'
    };
  }
}

/**
 * Change password on server database
 */
export async function serverChangePassword(
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, oldPassword, newPassword })
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string }>(
      res,
      'Gagal memperbarui password di server database.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Password berhasil diperbarui.' : 'Gagal memperbarui password di server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal memperbarui password di server database.'
    };
  }
}

/**
 * Create new user account on server database
 */
export async function createServerUser(
  userData: {
    username: string;
    password: string;
    name: string;
    role: string;
    department: string;
    email?: string;
    phone?: string;
    nik?: string;
    bio?: string;
    avatarUrl?: string;
  }
): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; user?: UserAccount }>(
      res,
      'Gagal membuat pengguna baru di server.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Pengguna berhasil dibuat.' : 'Gagal membuat pengguna di server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal membuat pengguna baru di server.'
    };
  }
}

/**
 * Delete user account on server database
 */
export async function deleteServerUser(
  username: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string }>(
      res,
      'Gagal menghapus pengguna dari server.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Pengguna berhasil dihapus.' : 'Gagal menghapus pengguna dari server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal menghapus pengguna dari server.'
    };
  }
}

/**
 * Save persistent system configuration on server database
 */
export async function saveServerSystemConfig(
  config: Partial<SystemConfig>
): Promise<{ success: boolean; message: string; config?: SystemConfig }> {
  try {
    const res = await fetch('/api/system/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const { ok, data, message } = await safeParseJson<{ success: boolean; message: string; config?: SystemConfig }>(
      res,
      'Gagal menyimpan konfigurasi ke server.'
    );

    if (data && typeof data.success === 'boolean') {
      return data;
    }

    return {
      success: ok,
      message: message || (ok ? 'Konfigurasi berhasil disimpan.' : 'Gagal menyimpan konfigurasi ke server.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Gagal menyimpan konfigurasi ke server.'
    };
  }
}

/**
 * Fetch persistent activity audit logs from server database
 */
export async function fetchServerActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
  try {
    const res = await fetch(`/api/system/activity-logs?limit=${limit}`);
    const { ok, data } = await safeParseJson<{ success: boolean; logs?: ActivityLog[] }>(res, '');
    if (ok && data?.logs) {
      return data.logs;
    }
    return [];
  } catch (err) {
    return [];
  }
}

/**
 * Fetch persistent email logs from server database
 */
export async function fetchServerEmailLogs(limit: number = 50): Promise<EmailLog[]> {
  try {
    const res = await fetch(`/api/system/email-logs?limit=${limit}`);
    const { ok, data } = await safeParseJson<{ success: boolean; logs?: EmailLog[] }>(res, '');
    if (ok && data?.logs) {
      return data.logs;
    }
    return [];
  } catch (err) {
    return [];
  }
}

