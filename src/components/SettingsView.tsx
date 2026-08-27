import React, { useState, useEffect } from 'react';
import { Employee, PeriodsData, UserSession, AppFiltersState } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { changePassword, updateUserProfile, duplicatePeriod, exportDatabaseCsv, buildReportPdfDoc, AJINOMOTO_LOGO_URL } from '../utils/storage';
import { DEFAULT_GOOGLE_SHEET_URL, getSavedGoogleSheetUrl } from '../utils/syncService';
import { SmtpConfig, getSavedSmtpConfig, saveSmtpConfig, testSmtpConnection } from '../utils/emailReportService';
import { ExportExcelConfirmModal } from './ExportExcelConfirmModal';
import { ExportPdfModal } from './ExportPdfModal';
import { ConfirmationModal, ConfirmationVariant } from './ConfirmationModal';
import confetti from 'canvas-confetti';

interface SettingsViewProps {
  currentUser: UserSession;
  employees: Employee[];
  filteredEmployees: Employee[];
  filters: AppFiltersState;
  periods: PeriodsData;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onRefreshData: (newEmployees: Employee[]) => void;
  onOpenImportModal?: () => void;
  onUpdateCurrentUser?: (user: UserSession) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  employees,
  filteredEmployees,
  filters,
  periods,
  isDarkMode,
  onToggleDarkMode,
  onRefreshData,
  onOpenImportModal,
  onUpdateCurrentUser
}) => {
  // 0. Profile State
  const [adminName, setAdminName] = useState(currentUser.name || 'Mahmud Nurdiansyah');
  const [adminUsername, setAdminUsername] = useState(currentUser.username || 'hr_admin');
  const [adminNik, setAdminNik] = useState(currentUser.nik || 'AJI-HRD-0104');
  const [adminRole, setAdminRole] = useState(currentUser.role || 'HR Development Admin');
  const [adminDepartment, setAdminDepartment] = useState(currentUser.department || 'Human Resources Development');
  const [adminEmail, setAdminEmail] = useState(currentUser.email || 'mahmud.nurdiansyah@ajinomoto.co.id');
  const [adminPhone, setAdminPhone] = useState(currentUser.phone || '0812-3456-7890');
  const [adminBio, setAdminBio] = useState(currentUser.bio || 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.');
  const [adminAvatarUrl, setAdminAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [profileAlert, setProfileAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // Sync state when currentUser prop changes
  useEffect(() => {
    setAdminName(currentUser.name || 'Mahmud Nurdiansyah');
    setAdminUsername(currentUser.username || 'hr_admin');
    setAdminNik(currentUser.nik || 'AJI-HRD-0104');
    setAdminRole(currentUser.role || 'HR Development Admin');
    setAdminDepartment(currentUser.department || 'Human Resources Development');
    setAdminEmail(currentUser.email || 'mahmud.nurdiansyah@ajinomoto.co.id');
    setAdminPhone(currentUser.phone || '0812-3456-7890');
    setAdminBio(currentUser.bio || 'Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia Mojokerto Factory.');
    setAdminAvatarUrl(currentUser.avatarUrl || '');
  }, [currentUser]);

  // 1. Ganti Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordAlert, setPasswordAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // 2. Duplikasi Periode State
  const latestPeriod = periods.tahunList.length
    ? {
        tahun: periods.tahunList[0],
        bulan: (periods.bulanByTahun[String(periods.tahunList[0])] || [1])[0] || 1
      }
    : { tahun: 2026, bulan: 8 };

  const [dupSourceTahun, setDupSourceTahun] = useState<number>(latestPeriod.tahun);
  const [dupSourceBulan, setDupSourceBulan] = useState<number>(latestPeriod.bulan);

  // Compute default target (next month)
  const nextTarget = dupSourceBulan >= 12
    ? { tahun: dupSourceTahun + 1, bulan: 1 }
    : { tahun: dupSourceTahun, bulan: dupSourceBulan + 1 };

  const [dupTargetTahun, setDupTargetTahun] = useState<number>(nextTarget.tahun);
  const [dupTargetBulan, setDupTargetBulan] = useState<number>(nextTarget.bulan);
  const [dupAlert, setDupAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingDup, setIsSubmittingDup] = useState(false);

  // Custom Modal Confirmation State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode | string;
    confirmLabel?: string;
    variant?: ConfirmationVariant;
    icon?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // 3. PDF Report Preview State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isEmailRowOpen, setIsEmailRowOpen] = useState(false);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // 4. Excel Download Confirmation Modal State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // 5. SMTP Server Configuration State
  const [smtpSettings, setSmtpSettings] = useState<SmtpConfig>(getSavedSmtpConfig());
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpAlert, setSmtpAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSmtpSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSmtpConfig(smtpSettings);
    setSmtpAlert({ type: 'success', message: 'Konfigurasi SMTP server berhasil diperbarui.' });
    setTimeout(() => setSmtpAlert(null), 4000);
  };

  const handleTestSmtpConnection = async () => {
    setIsTestingSmtp(true);
    setSmtpAlert(null);
    const res = await testSmtpConnection(smtpSettings);
    setIsTestingSmtp(false);
    setSmtpAlert({ type: res.success ? 'success' : 'error', message: res.message });
  };

  // Handle Change Password
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordAlert(null);

    if (newPassword !== confirmPassword) {
      setPasswordAlert({ type: 'error', message: 'Konfirmasi password baru tidak sama.' });
      return;
    }

    setIsSubmittingPassword(true);
    setTimeout(() => {
      const res = changePassword(currentUser.username, oldPassword, newPassword);
      setIsSubmittingPassword(false);
      setPasswordAlert({ type: res.success ? 'success' : 'error', message: res.message });
      if (res.success) {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    }, 350);
  };

  const executeDuplicate = () => {
    setIsSubmittingDup(true);
    setTimeout(() => {
      const res = duplicatePeriod(employees, dupSourceTahun, dupSourceBulan, dupTargetTahun, dupTargetBulan);
      setIsSubmittingDup(false);

      if (res.success) {
        setDupAlert({ type: 'success', message: res.message });
        onRefreshData(res.employees);
        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        } catch (_) {}
      } else {
        setDupAlert({ type: 'error', message: res.message });
      }
    }, 450);
  };

  // Handle Duplicate Period
  const handleDuplicateSubmit = () => {
    setDupAlert(null);

    if (dupSourceTahun === dupTargetTahun && dupSourceBulan === dupTargetBulan) {
      setDupAlert({ type: 'error', message: 'Periode sumber dan tujuan tidak boleh sama.' });
      return;
    }

    // Check if target period already has data
    const existingInTarget = employees.filter(
      (e) => Number(e.tahun) === Number(dupTargetTahun) && Number(e.bulan) === Number(dupTargetBulan)
    );

    if (existingInTarget.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Konfirmasi Duplikasi ke Periode yang Ada',
        variant: 'warning',
        icon: 'fa-solid fa-clone',
        confirmLabel: 'Ya, Lanjutkan Duplikasi',
        description: (
          <div className="space-y-3">
            <p>
              Periode target <strong>{BULAN_LABELS[dupTargetBulan - 1]} {dupTargetTahun}</strong> saat ini telah memiliki <strong>{existingInTarget.length} data karyawan</strong>.
            </p>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                <span>Mode Penambahan (Append)</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Duplikasi akan MENAMBAH data baru dari periode sumber, bukan menimpa atau menghapus data yang sudah ada di periode target.
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lanjutkan proses penggandaan struktur matriks ke periode ini?
            </p>
          </div>
        ),
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          executeDuplicate();
        }
      });
      return;
    }

    executeDuplicate();
  };

  // Handle Profile Avatar File Change
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileAlert({ type: 'error', message: 'Silakan pilih file gambar yang valid (PNG, JPG, JPEG, WEBP).' });
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setProfileAlert({ type: 'error', message: 'Ukuran file foto maksimal 2.5 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAdminAvatarUrl(reader.result);
        setProfileAlert(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Profile Submit
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileAlert(null);

    if (!adminName.trim()) {
      setProfileAlert({ type: 'error', message: 'Nama lengkap administrator wajib diisi.' });
      return;
    }
    if (!adminUsername.trim()) {
      setProfileAlert({ type: 'error', message: 'Username login wajib diisi.' });
      return;
    }

    setIsSubmittingProfile(true);
    setTimeout(() => {
      const res = updateUserProfile(currentUser.username, {
        name: adminName.trim(),
        username: adminUsername.trim(),
        nik: adminNik.trim(),
        role: adminRole.trim(),
        department: adminDepartment.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        bio: adminBio.trim(),
        avatarUrl: adminAvatarUrl
      });

      setIsSubmittingProfile(false);
      if (res.success && res.session) {
        setProfileAlert({ type: 'success', message: res.message });
        if (onUpdateCurrentUser) {
          onUpdateCurrentUser(res.session);
        }
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.4 } });
        } catch (_) {}
      } else {
        setProfileAlert({ type: 'error', message: res.message });
      }
    }, 350);
  };

  // Handle PDF Generation & Download
  const handleDownloadPdfDirect = () => {
    const doc = buildReportPdfDoc(filteredEmployees, filters, {
      name: currentUser.name,
      role: currentUser.role
    });
    doc.save(`Laporan_MultiSkill_${Date.now()}.pdf`);
  };

  // Handle Send Report Email Simulation
  const handleSendEmail = () => {
    setEmailAlert(null);
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email tujuan yang valid.' });
      return;
    }

    setIsSendingEmail(true);
    setTimeout(() => {
      setIsSendingEmail(false);
      setEmailAlert({
        type: 'success',
        message: `Laporan Multi-Skill bertanda tangan elektronik berhasil dikirim ke ${emailInput}.`
      });
      try {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      } catch (_) {}
    }, 800);
  };

  const userInitial = adminName
    ? adminName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'HR';

  return (
    <div className="space-y-6">
      {/* ROW 0: PROFIL ADMINISTRATOR UTAMA */}
      <div className="card-elegant p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="relative group shrink-0">
              {adminAvatarUrl ? (
                <img
                  src={adminAvatarUrl}
                  alt={adminName}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-md ring-4 ring-amber-400/30"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black flex items-center justify-center text-xl sm:text-2xl shadow-md ring-4 ring-amber-400/30">
                  {userInitial}
                </div>
              )}
              <label
                htmlFor="avatar-upload-input"
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
                title="Unggah Foto Profil Baru"
              >
                <i className="fa-solid fa-camera text-xs"></i>
                <input
                  id="avatar-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <h3 className="font-display font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                  {adminName || 'Mahmud Nurdiansyah'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-[10px]"></i>
                  <span>Administrator Sistem</span>
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2 flex-wrap">
                <span>{adminRole}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>{adminDepartment}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-mono text-indigo-600 dark:text-cyan-400">NIK: {adminNik}</span>
              </p>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="avatar-upload-input"
                  className="text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-solid fa-arrow-up-from-bracket text-[10px]"></i>
                  <span>Ganti Foto</span>
                </label>
                {adminAvatarUrl && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setAdminAvatarUrl('')}
                      className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <i className="fa-solid fa-trash-can text-[10px]"></i>
                      <span>Hapus Foto</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Otoritas</p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Aktif &amp; Terverifikasi</span>
              </p>
            </div>
          </div>
        </div>

        {/* PROFILE EDIT FORM */}
        <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4">
          {profileAlert && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                profileAlert.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              <i className={`fa-solid ${profileAlert.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
              <span>{profileAlert.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Nama Lengkap (Otoritas) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Contoh: Mahmud Nurdiansyah"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Username Login <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Contoh: hr_admin"
                className="input-elegant w-full px-3 py-2 outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                NIK (Nomor Induk Karyawan)
              </label>
              <input
                type="text"
                value={adminNik}
                onChange={(e) => setAdminNik(e.target.value)}
                placeholder="Contoh: AJI-HRD-0104"
                className="input-elegant w-full px-3 py-2 outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Jabatan / Role
              </label>
              <input
                type="text"
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value)}
                placeholder="Contoh: HR Development Admin"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Departemen
              </label>
              <input
                type="text"
                value={adminDepartment}
                onChange={(e) => setAdminDepartment(e.target.value)}
                placeholder="Contoh: Human Resources Development"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Email Resmi
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Contoh: mahmud.nurdiansyah@ajinomoto.co.id"
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Nomor Kontak / WhatsApp
              </label>
              <input
                type="tel"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="Contoh: 0812-3456-7890"
                className="input-elegant w-full px-3 py-2 outline-none text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Catatan / Deskripsi Wewenang
              </label>
              <input
                type="text"
                value={adminBio}
                onChange={(e) => setAdminBio(e.target.value)}
                placeholder="Contoh: Administrator Multi-Skill Monitoring & Pengembangan Kompetensi Karyawan PT Ajinomoto Indonesia..."
                className="input-elegant w-full px-3 py-2 outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-400">
              Perubahan profil akan langsung disinkronkan ke header, sidebar, dan laporan resmi PDF.
            </p>
            <button
              type="submit"
              disabled={isSubmittingProfile}
              className="btn-navy px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
            >
              {isSubmittingProfile ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Menyimpan Profil...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk text-xs"></i>
                  <span>Simpan Perubahan Profil</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* ROW 1: GANTI PASSWORD & DARK MODE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* GANTI PASSWORD CARD */}
        <div className="card-elegant p-6 h-full flex flex-col justify-between">
          <div>
            <p className="section-title text-sm sm:text-base mb-1 flex items-center gap-2">
              <span
                className="chart-icon"
                style={{ width: '1.9rem', height: '1.9rem', background: 'linear-gradient(135deg, var(--navy), var(--navy-2))' }}
              >
                <i className="fa-solid fa-key text-[11px]"></i>
              </span>
              Ganti Password Akun
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Perbarui password akun <span className="font-bold text-slate-600">{currentUser.username}</span> secara berkala demi keamanan.
            </p>

            <form onSubmit={handlePasswordSubmit} id="password-form" className="space-y-4">
              {passwordAlert && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                    passwordAlert.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border border-rose-300'
                  }`}
                >
                  <i className={`fa-solid ${passwordAlert.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                  <span>{passwordAlert.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Password Lama</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-elegant w-full px-3 py-2 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Password Baru (min 6)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-elegant w-full px-3 py-2 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Konfirmasi Password Baru</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-elegant w-full px-3 py-2 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingPassword ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk text-xs"></i>
                      <span>Simpan Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* DARK MODE & TIPS */}
        <div className="flex flex-col gap-6 h-full">
          <div className="card-elegant p-6 flex items-center justify-between">
            <div className="pr-4">
              <p className="section-title text-sm sm:text-base mb-1 flex items-center gap-2">
                <i className="fa-solid fa-moon text-amber-500"></i> Tampilan Dark Mode
              </p>
              <p className="text-xs text-slate-400">
                Ubah tema aplikasi menjadi gelap agar lebih nyaman di mata saat bekerja malam hari.
              </p>
            </div>

            <button
              type="button"
              onClick={onToggleDarkMode}
              className={`toggle-switch shrink-0 ${isDarkMode ? 'on' : ''}`}
              aria-label="Toggle dark mode"
            >
              <span className="toggle-knob"></span>
            </button>
          </div>

          <div className="card-elegant p-6 flex-1 flex flex-col justify-center">
            <p className="section-title text-sm mb-3 flex items-center gap-2">
              <i className="fa-solid fa-circle-info text-amber-600"></i> Tips Pengelolaan Periode Bulanan
            </p>
            <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-circle text-[5px] mt-1.5 shrink-0 text-amber-600"></i>
                Gunakan <b>"Duplikasi Data ke Periode Baru"</b> setiap awal bulan, lalu tinggal sesuaikan checklist skill per karyawan.
              </li>
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-circle text-[5px] mt-1.5 shrink-0 text-amber-600"></i>
                Karyawan pensiun atau mutasi cukup dihapus pada periode berjalan lewat tab <b>Employee Multi-Skill</b>.
              </li>
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-circle text-[5px] mt-1.5 shrink-0 text-amber-600"></i>
                Karyawan baru cukup ditambahkan lewat tombol <b>"Tambah Karyawan"</b> pada tab yang sama.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ROW 2: DUPLIKASI DATA & DOWNLOAD DATA */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* DUPLIKASI PERIODE */}
        <div className="card-elegant p-6 h-full flex flex-col justify-between">
          <div>
            <p className="section-title text-sm sm:text-base mb-1 flex items-center gap-2">
              <span
                className="chart-icon"
                style={{ width: '1.9rem', height: '1.9rem', background: 'linear-gradient(135deg, var(--gold-light), var(--gold))' }}
              >
                <i className="fa-solid fa-copy text-[11px]"></i>
              </span>
              Duplikasi Data ke Periode Baru
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Saat pergantian bulan, salin seluruh data karyawan dari periode sebelumnya ke periode baru dengan cepat.
            </p>

            {dupAlert && (
              <div
                className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 mb-4 ${
                  dupAlert.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}
              >
                <i className={`fa-solid ${dupAlert.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                <span>{dupAlert.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Dari Periode (Sumber)</label>
                <div className="flex gap-2">
                  <select
                    value={dupSourceTahun}
                    onChange={(e) => setDupSourceTahun(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dupSourceBulan}
                    onChange={(e) => setDupSourceBulan(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {BULAN_LABELS.map((b, i) => (
                      <option key={i + 1} value={i + 1}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ke Periode (Target Baru)</label>
                <div className="flex gap-2">
                  <select
                    value={dupTargetTahun}
                    onChange={(e) => setDupTargetTahun(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dupTargetBulan}
                    onChange={(e) => setDupTargetBulan(Number(e.target.value))}
                    className="input-elegant w-1/2 text-xs sm:text-sm px-2.5 py-2 outline-none font-semibold cursor-pointer"
                  >
                    {BULAN_LABELS.map((b, i) => (
                      <option key={i + 1} value={i + 1}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDuplicateSubmit}
              disabled={isSubmittingDup}
              className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isSubmittingDup ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Memproses Duplikasi...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-copy text-xs"></i>
                  <span>Duplikasi Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* DOWNLOAD DATA & EXPORT */}
        <div className="card-elegant p-6 h-full flex flex-col justify-between">
          <div>
            <p className="section-title text-sm sm:text-base mb-1 flex items-center gap-2">
              <span
                className="chart-icon"
                style={{ width: '1.9rem', height: '1.9rem', background: 'linear-gradient(135deg, #6FA6D6, var(--blue))' }}
              >
                <i className="fa-solid fa-download text-[11px]"></i>
              </span>
              Unduh Data &amp; Laporan Resmi
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Laporan dalam format PDF resmi bertanda tangan elektronik HR, serta data mentah dalam format CSV.
            </p>

            <div className="grid grid-cols-1 gap-3.5">
              {/* Button: PDF Report with Preview */}
              <button
                type="button"
                onClick={() => {
                  setIsEmailRowOpen(false);
                  setEmailAlert(null);
                  setIsPdfModalOpen(true);
                }}
                className="card-elegant hoverable flex items-start gap-3.5 p-4 text-left border border-slate-200 transition cursor-pointer group"
              >
                <div className="stat-icon gold" style={{ width: '2.6rem', height: '2.6rem', fontSize: '0.95rem' }}>
                  <i className="fa-solid fa-file-pdf text-amber-600 dark:text-amber-400"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Download Report Data
                    <span className="badge-pill bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-2 py-0.5 font-bold">
                      PDF E-SIGN
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Laporan rekapitulasi (Divisi, Dept, Grade, Job Position) dengan tanda tangan elektronik HR &mdash; pratinjau, unduh, atau kirim email.
                  </p>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 self-center"></i>
              </button>

              {/* Button: Excel Database Data (with confirmation modal & Ajinomoto logo) */}
              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                className="card-elegant hoverable flex items-start gap-3.5 p-4 text-left border border-emerald-300/80 dark:border-emerald-800/80 transition cursor-pointer group bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20"
              >
                <div className="stat-icon emerald" style={{ width: '2.6rem', height: '2.6rem', fontSize: '0.95rem' }}>
                  <i className="fa-solid fa-file-excel text-emerald-600 dark:text-emerald-400"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Download Database Excel
                    <span className="badge-pill bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] px-2 py-0.5 font-bold">
                      OFFICIAL EXCEL &amp; LOGO
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Format spreadsheet resmi dengan kop surat, logo Ajinomoto, rekapitulasi KPI, serta seluruh 92+ kolom matriks skill.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
                      <i className="fa-solid fa-download text-[10px]"></i> Buka Konfirmasi Download
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        exportDatabaseCsv(employees);
                      }}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer"
                      title="Unduh file CSV sederhana tanpa format kop"
                    >
                      Opsi CSV Mentah
                    </span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 self-center"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Toast Notification */}
      {exportToast && (
        <div className="card-elegant p-3.5 border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 text-base"></i>
            <span>{exportToast}</span>
          </div>
          <button
            onClick={() => setExportToast(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 cursor-pointer text-xs"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* ROW 3: SINKRONISASI CLOUD DATABASE & GOOGLE SHEETS */}
      <div className="card-elegant p-6 border border-emerald-500/30 bg-gradient-to-br from-white via-white to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-cloud-arrow-down text-emerald-600 dark:text-emerald-400"></i> Cloud &amp; Spreadsheet Synchronization
            </p>
            <h3 className="section-title text-base sm:text-lg mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              Sinkronisasi Database Supabase &amp; Google Sheets
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Tarik atau unggah data matriks skill secara langsung dan otomatis dari spreadsheet <b>Google Sheets</b> (link online) atau database cloud <b>Supabase</b> (REST API &amp; PostgreSQL) dengan validasi dan perbandingan otomatis.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer hover:opacity-95 transition"
              >
                <i className="fa-solid fa-cloud-arrow-down text-xs text-amber-400"></i>
                <span>Buka Panel Import / Cloud Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Master Connected Google Sheet Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <i className="fa-solid fa-file-excel text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>Spreadsheet Google Sheets Master:</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold">Tersambung</span>
              </p>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                {getSavedGoogleSheetUrl()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getSavedGoogleSheetUrl()}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-blue-500"></i> Buka Sheet
            </a>
            {onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <i className="fa-solid fa-arrows-rotate text-[10px]"></i> Sinkronkan Data
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ROW 4: PENGATURAN SERVER EMAIL LANGSUNG & SMTP */}
      <div className="card-elegant p-6 border border-indigo-500/30 bg-gradient-to-br from-white via-white to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-indigo-600 dark:text-indigo-400 text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <i className="fa-solid fa-server text-indigo-600 dark:text-indigo-400"></i> Direct Mail Server &amp; SMTP
            </p>
            <h3 className="section-title text-base sm:text-lg mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              Konfigurasi Server Pengiriman Email Langsung
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Atur server email untuk pengiriman laporan PDF resmi secara langsung dari sistem ke pimpinan pabrik tanpa perlu membuka aplikasi email eksternal.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTestSmtpConnection}
              disabled={isTestingSmtp || (!smtpSettings.enabled && !smtpSettings.host)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isTestingSmtp ? (
                <>
                  <span className="w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"></span>
                  <span>Menguji...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plug text-indigo-500 text-[11px]"></i>
                  <span>Uji Koneksi</span>
                </>
              )}
            </button>
          </div>
        </div>

        {smtpAlert && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
              smtpAlert.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <i className={`fa-solid ${smtpAlert.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'}`}></i>
            <span>{smtpAlert.message}</span>
          </div>
        )}

        <form onSubmit={handleSmtpSave} className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={smtpSettings.enabled}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, enabled: e.target.checked })}
                className="rounded text-indigo-600"
              />
              <span>Aktifkan Kustomisasi SMTP Server Enterprise (Opsional)</span>
            </label>

            {smtpSettings.enabled ? (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Host Server:
                    </label>
                    <input
                      type="text"
                      value={smtpSettings.host}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      placeholder="mail.ajinomoto.co.id / smtp.office365.com"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Port:
                    </label>
                    <input
                      type="number"
                      value={smtpSettings.port}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, port: Number(e.target.value) || 587 })}
                      placeholder="587 / 465 / 25"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      SMTP User:
                    </label>
                    <input
                      type="text"
                      value={smtpSettings.user}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                      placeholder="hr.monitoring@ajinomoto.co.id"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      SMTP Password:
                    </label>
                    <input
                      type="password"
                      value={smtpSettings.pass}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                      placeholder="••••••••••••"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Nama Pengirim:
                    </label>
                    <input
                      type="text"
                      value={smtpSettings.fromName}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                      placeholder="PT Ajinomoto Indonesia — Mojokerto Factory"
                      className="input-elegant w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Email Pengirim (From Header):
                    </label>
                    <input
                      type="email"
                      value={smtpSettings.fromEmail}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                      placeholder="noreply@ajinomoto.co.id"
                      className="input-elegant w-full px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={smtpSettings.secure}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Gunakan Koneksi SSL/TLS Langsung (Wajib jika Port 465)</span>
                </label>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/60 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-blue-600"></i>
                  <span>Sistem aktif menggunakan <strong>Direct System Dispatcher</strong> bawaan.</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold">
                  Siap Kirim
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-navy px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer hover:opacity-95"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>Simpan Pengaturan Email</span>
            </button>
          </div>
        </form>
      </div>

      {/* ================= MODAL: PREVIEW & EXPORT LAPORAN PDF RESMI (GAS FORMAT) ================= */}
      <ExportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        filteredEmployees={filteredEmployees}
        allEmployees={employees}
        filters={filters}
        currentUser={currentUser}
        onExportSuccess={(msg) => setExportToast(msg)}
      />

      {/* ================= MODAL: KONFIRMASI DOWNLOAD EXCEL ================= */}
      <ExportExcelConfirmModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        filteredEmployees={filteredEmployees}
        allEmployees={employees}
        filters={filters}
        currentUser={currentUser}
        onExportSuccess={(msg) => setExportToast(msg)}
      />

      {/* Confirmation Dialog */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        icon={confirmModal.icon}
        isDarkMode={isDarkMode}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
