import { UserAccount, UserSession, SystemConfig, ActivityLog, EmailLog } from '../types';

export interface SystemInitData {
  users: UserAccount[];
  config: SystemConfig;
  recentLogs: ActivityLog[];
  emailLogs: EmailLog[];
}

/**
 * Fetch all initial persistent system database data from server.
 * This guarantees that when a user opens Incognito mode, another tab, or another device,
 * the latest profiles, avatars, settings, and users are completely synced.
 */
export async function fetchSystemInit(): Promise<SystemInitData | null> {
  try {
    const res = await fetch('/api/system/init');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (data.success) {
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
    const data = await res.json();
    return data;
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
    const data = await res.json();
    return data;
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
    const data = await res.json();
    return data;
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
    const data = await res.json();
    return data;
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
    const data = await res.json();
    return data;
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
    const data = await res.json();
    return data;
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
    const data = await res.json();
    return data;
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
    const data = await res.json();
    return data;
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
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs || [];
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
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs || [];
  } catch (err) {
    return [];
  }
}
