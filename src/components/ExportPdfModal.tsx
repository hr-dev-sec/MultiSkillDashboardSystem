import React, { useState, useEffect } from 'react';
import { Employee, AppFiltersState, UserSession } from '../types';
import { generateMultiSkillReportPdf } from '../utils/pdfExport';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from '../utils/storage';
import { ConfirmationModal } from './ConfirmationModal';
import {
  EmailCustomContent,
  EmailHistoryItem,
  SmtpConfig,
  getDefaultEmailContent,
  buildMultiSkillEmailDraft,
  sendMultiSkillEmailReport,
  getSavedSmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
  getEmailHistory,
  clearEmailHistory,
  getSavedEmailWebhookUrl,
  saveEmailWebhookUrl
} from '../utils/emailReportService';
import confetti from 'canvas-confetti';

interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredEmployees: Employee[];
  allEmployees: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  onExportSuccess?: (msg: string) => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  filteredEmployees,
  allEmployees,
  filters,
  currentUser,
  onExportSuccess
}) => {
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [reportType, setReportType] = useState<'comprehensive' | 'executive' | 'employee_detail'>('comprehensive');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  // Custom approver signatures
  const [signerName, setSignerName] = useState(currentUser.name || 'Mahmud Nurdiansyah');
  const [signerRole, setSignerRole] = useState(currentUser.role || 'HR Development Specialist');

  // Preview tab state: 'page1' | 'page2' | 'page3' | 'email' | 'history' | 'smtp'
  const [activePreviewPage, setActivePreviewPage] = useState<'page1' | 'page2' | 'page3' | 'email' | 'history' | 'smtp'>('page1');

  // Email Drawer / Editor state
  const [isEmailRowOpen, setIsEmailRowOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendingStep, setEmailSendingStep] = useState<string>('');
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string; previewUrl?: string } | null>(null);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  const [showAdvancedHeaders, setShowAdvancedHeaders] = useState(false);
  
  // Editable Email Content
  const [emailContent, setEmailContent] = useState<EmailCustomContent>(() =>
    getDefaultEmailContent({
      targetData: filteredEmployees,
      filters,
      toEmail: 'pimpinan@ajinomoto.co.id'
    })
  );

  // Email view sub-mode: 'visual_preview' | 'edit' | 'plain_preview'
  const [emailViewMode, setEmailViewMode] = useState<'visual_preview' | 'edit' | 'plain_preview'>('visual_preview');

  // SMTP Settings State
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(getSavedSmtpConfig());
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Dispatch History
  const [dispatchHistory, setDispatchHistory] = useState<EmailHistoryItem[]>([]);

  // Webhook configuration
  const [emailWebhookUrl, setEmailWebhookUrlState] = useState(getSavedEmailWebhookUrl());

  // Loading generation state for PDF download
  const [isGenerating, setIsGenerating] = useState(false);

  // PDF Generation Error Modal State
  const [errorModalMsg, setErrorModalMsg] = useState<string | null>(null);

  // Load email history and SMTP config on modal open
  useEffect(() => {
    if (isOpen) {
      setDispatchHistory(getEmailHistory());
      setSmtpConfig(getSavedSmtpConfig());
    }
  }, [isOpen]);

  // Sync email default content when filters or scope change
  useEffect(() => {
    const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
    const defaults = getDefaultEmailContent({ targetData, filters, toEmail: emailContent.toEmail });
    setEmailContent((prev) => ({
      ...prev,
      toEmail: prev.toEmail || defaults.toEmail
    }));
  }, [scope, filters, filteredEmployees, allEmployees]);

  if (!isOpen) return null;

  const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
  const stats = computeDashboardStats(targetData);
  const { totalMS, totalUS, totalManpower, percentMS, byDivisi, byDepartment, byGrade, byPosition } = stats;
  const pctFormatted = (percentMS * 100).toFixed(1) + '%';

  const thnStr = filters.tahun.join(', ') || '2026';
  const blnStr = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : 'Juli';
  const divStr = filters.divisi.join(', ') || '';
  const deptStr = filters.department.join(', ') || '';
  const jabStr = filters.jabatan.join(', ') || '';

  const emailDraftPayload = buildMultiSkillEmailDraft({
    targetData,
    filters,
    currentUser,
    customContent: emailContent
  });

  const handleResetEmailToDefault = () => {
    const defaultData = getDefaultEmailContent({ targetData, filters, toEmail: emailContent.toEmail });
    setEmailContent(defaultData);
    setEmailAlert({ type: 'success', message: 'Format redaksional email telah dikembalikan ke standar resmi.' });
    setTimeout(() => setEmailAlert(null), 3000);
  };

  const handleCopyEmailText = async () => {
    try {
      await navigator.clipboard.writeText(emailDraftPayload.plainTextBody);
      setCopiedEmailText(true);
      setTimeout(() => setCopiedEmailText(false), 2500);
    } catch (_) {}
  };

  // Unduh PDF ke komputer lokal
  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const result = generateMultiSkillReportPdf({
          scope,
          filteredEmployees,
          allEmployees,
          filters,
          currentUser,
          reportType,
          orientation,
          approvers: {
            preparedBy: { name: signerName, title: signerRole }
          }
        });

        result.doc.save(result.filename);
        setIsGenerating(false);

        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch (_) {}

        const msg = `Berhasil mengunduh dokumen Laporan PDF (${result.pageCount} Halaman, ${result.rowCount} Karyawan) bertanda tangan resmi.`;
        if (onExportSuccess) {
          onExportSuccess(msg);
        }
        onClose();
      } catch (err: any) {
        setIsGenerating(false);
        setErrorModalMsg(err?.message || 'Terjadi kesalahan sistem saat menyusun dokumen PDF.');
      }
    }, 350);
  };

  // KIRIM EMAIL LANGSUNG DARI SISTEM (Disertai Attachment PDF Otomatis)
  const handleSendEmailDirect = async () => {
    setEmailAlert(null);
    if (!emailContent.toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContent.toEmail.trim())) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima / pimpinan yang valid.' });
      return;
    }

    setIsSendingEmail(true);
    setEmailSendingStep('Menyusun dokumen PDF resmi 3 halaman...');

    try {
      // Step 1: Generate PDF in memory
      await new Promise((resolve) => setTimeout(resolve, 200));
      const pdfResult = generateMultiSkillReportPdf({
        scope,
        filteredEmployees,
        allEmployees,
        filters,
        currentUser,
        reportType,
        orientation,
        approvers: {
          preparedBy: { name: signerName, title: signerRole }
        }
      });

      // Extract Base64 Data URI from jsPDF
      const pdfBase64 = pdfResult.doc.output('datauristring');
      const pdfFileName = pdfResult.filename;

      // Step 2: Build Payload & connect to system dispatch API
      setEmailSendingStep('Mengirim laporan resmi langsung via server...');
      const payload = buildMultiSkillEmailDraft({
        targetData,
        filters,
        currentUser,
        customContent: emailContent
      });

      // Step 3: Send directly from backend
      const res = await sendMultiSkillEmailReport(payload, pdfBase64, pdfFileName);
      setIsSendingEmail(false);
      setEmailSendingStep('');

      // Refresh history list
      setDispatchHistory(getEmailHistory());

      if (res.success) {
        setEmailAlert({
          type: 'success',
          message: res.message,
          previewUrl: res.previewUrl
        });
        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch (_) {}
      } else {
        setEmailAlert({
          type: 'error',
          message: res.message
        });
      }
    } catch (err: any) {
      setIsSendingEmail(false);
      setEmailSendingStep('');
      setEmailAlert({
        type: 'error',
        message: `Gagal mengirim email: ${err?.message || 'Terjadi gangguan internal pada sistem.'}`
      });
    }
  };

  // Preset SMTP Handlers
  const handleApplySmtpPreset = (preset: 'direct' | 'ajinomoto' | 'office365' | 'gmail') => {
    if (preset === 'direct') {
      const updated: SmtpConfig = {
        enabled: false,
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromName: 'Multi-Skill Monitoring — Ajinomoto Mojokerto Factory',
        fromEmail: 'noreply@ajinomoto.co.id'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    } else if (preset === 'ajinomoto') {
      const updated: SmtpConfig = {
        enabled: true,
        host: 'mail.ajinomoto.co.id',
        port: 587,
        secure: false,
        user: 'hr.monitoring@ajinomoto.co.id',
        pass: '',
        fromName: 'PT Ajinomoto Indonesia — Mojokerto Factory',
        fromEmail: 'hr.monitoring@ajinomoto.co.id'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    } else if (preset === 'office365') {
      const updated: SmtpConfig = {
        enabled: true,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        user: currentUser.email || 'hr.admin@ajinomoto.co.id',
        pass: '',
        fromName: 'HR Multi-Skill Monitoring System',
        fromEmail: currentUser.email || 'hr.admin@ajinomoto.co.id'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    } else if (preset === 'gmail') {
      const updated: SmtpConfig = {
        enabled: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: currentUser.email || 'mahmudnurdiansyah4@gmail.com',
        pass: '',
        fromName: 'Ajinomoto Multi-Skill Monitoring',
        fromEmail: currentUser.email || 'mahmudnurdiansyah4@gmail.com'
      };
      setSmtpConfig(updated);
      saveSmtpConfig(updated);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    const res = await testSmtpConnection(smtpConfig);
    setIsTestingSmtp(false);
    setSmtpTestResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-50 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0E2340] to-[#16345E] text-white flex items-center justify-center shadow-md">
              <i className="fa-solid fa-file-pdf text-amber-400 text-lg"></i>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Laporan Multi-Skill Monitoring &amp; Pengiriman Email</span>
                <span className="badge-pill bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] px-2 py-0.5 font-bold">
                  DIRECT SYSTEM DISPATCH
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PT Ajinomoto Indonesia &bull; Mojokerto Factory &bull; Format 3 Halaman Resmi &amp; Pengiriman Email Langsung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Modal Body: Split into Left Config and Right Live Preview */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left Column: Configuration & E-Sign Settings (5 Cols) */}
          <div className="lg:col-span-5 p-5 space-y-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Scope Selection */}
            <div className="card-elegant p-4 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                1. Cakupan Data Laporan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('filtered')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs font-semibold cursor-pointer ${
                    scope === 'filtered'
                      ? 'border-[#0E2340] dark:border-amber-400 bg-white dark:bg-slate-800 text-[#0E2340] dark:text-amber-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white/60'
                  }`}
                >
                  <p className="font-bold flex items-center justify-between">
                    <span>Sesuai Filter Aktif</span>
                    <i className="fa-solid fa-filter text-[10px]"></i>
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {filteredEmployees.length} Karyawan ({blnStr} {thnStr})
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs font-semibold cursor-pointer ${
                    scope === 'all'
                      ? 'border-[#0E2340] dark:border-amber-400 bg-white dark:bg-slate-800 text-[#0E2340] dark:text-amber-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white/60'
                  }`}
                >
                  <p className="font-bold flex items-center justify-between">
                    <span>Seluruh Database</span>
                    <i className="fa-solid fa-database text-[10px]"></i>
                  </p>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {allEmployees.length} Total Rekam Data
                  </p>
                </button>
              </div>

              {scope === 'filtered' && (
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
                  <p className="font-bold flex items-center gap-1">
                    <i className="fa-solid fa-circle-info text-[10px]"></i> Filter Parameter:
                  </p>
                  <p className="truncate">
                    Periode: <strong>{blnStr} {thnStr}</strong> {divStr ? `| Divisi: ${divStr}` : ''} {deptStr ? `| Dept: ${deptStr}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Quick KPI Stats Overview */}
            <div className="card-elegant p-4 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                2. Rekapitulasi Metrik PDF
              </label>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Total</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{totalManpower}</p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">MS</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalMS}</p>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50">
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">US</p>
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{totalUS}</p>
                </div>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold">% MS</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{pctFormatted}</p>
                </div>
              </div>
            </div>

            {/* Signer Customization */}
            <div className="card-elegant p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span>3. Pejabat Penanda Tangan (E-Sign)</span>
                <span className="text-[10px] font-normal text-slate-400">Dicetak pada Lembar Hal. 3</span>
              </label>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Nama Approver / Penyusun:</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="input-elegant w-full px-3 py-1.5 text-xs outline-none font-semibold text-slate-800 dark:text-slate-100"
                    placeholder="Nama Penanda Tangan"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Jabatan / Role:</label>
                  <input
                    type="text"
                    value={signerRole}
                    onChange={(e) => setSignerRole(e.target.value)}
                    className="input-elegant w-full px-3 py-1.5 text-xs outline-none text-slate-800 dark:text-slate-100"
                    placeholder="Jabatan di HR"
                  />
                </div>
              </div>
            </div>

            {/* Direct Email Server Status Indicator */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <i className="fa-solid fa-paper-plane text-emerald-600"></i>
                  Pengiriman Email Langsung:
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                  {smtpConfig.enabled ? 'Custom SMTP' : 'Direct Server'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Sistem mengirimkan email beserta <strong>lampiran file PDF laporan resmi</strong> secara langsung ke email pimpinan tanpa perlu membuka Outlook atau Gmail.
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Live Preview, Email Editor, SMTP & Logs (7 Cols) */}
          <div className="lg:col-span-7 p-5 flex flex-col min-h-0 bg-white dark:bg-slate-900">
            {/* Navigation Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('page1')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activePreviewPage === 'page1'
                      ? 'bg-white dark:bg-slate-900 text-[#0E2340] dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Hal 1 (Div &amp; Dept)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('page2')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activePreviewPage === 'page2'
                      ? 'bg-white dark:bg-slate-900 text-[#0E2340] dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Hal 2 (Grade &amp; Job)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('page3')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activePreviewPage === 'page3'
                      ? 'bg-white dark:bg-slate-900 text-[#0E2340] dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Hal 3 (E-Sign)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('email')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activePreviewPage === 'email'
                      ? 'bg-[#0E2340] text-amber-300 shadow-sm'
                      : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                  }`}
                >
                  <i className="fa-regular fa-envelope text-[11px]"></i>
                  <span>Kirim Email Langsung</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('smtp')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    activePreviewPage === 'smtp'
                      ? 'bg-slate-800 text-amber-300'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Pengaturan SMTP & Server Email"
                >
                  <i className="fa-solid fa-gear text-[10px]"></i>
                  <span>SMTP</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('history')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    activePreviewPage === 'history'
                      ? 'bg-slate-800 text-amber-300'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Riwayat Pengiriman Email"
                >
                  <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
                  <span>Log ({dispatchHistory.length})</span>
                </button>
              </div>

              {activePreviewPage === 'email' && (
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEmailViewMode('visual_preview')}
                    className={`px-2 py-1 rounded-md font-semibold transition cursor-pointer ${
                      emailViewMode === 'visual_preview' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailViewMode('edit')}
                    className={`px-2 py-1 rounded-md font-semibold transition cursor-pointer ${
                      emailViewMode === 'edit' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <i className="fa-solid fa-pen-to-square text-[10px] mr-1"></i>Edit Teks
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailViewMode('plain_preview')}
                    className={`px-2 py-1 rounded-md font-semibold transition cursor-pointer ${
                      emailViewMode === 'plain_preview' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Teks
                  </button>
                </div>
              )}
            </div>

            {/* Preview Sheet Canvas / Email Viewer / SMTP / Logs */}
            <div className="flex-1 overflow-y-auto mt-3 p-3 sm:p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-center">
              {activePreviewPage === 'smtp' ? (
                /* SMTP CONFIGURATION PANEL */
                <div className="w-full max-w-xl space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                          <i className="fa-solid fa-server text-indigo-600"></i>
                          Konfigurasi Server Email &amp; SMTP
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Atur server relay internal Ajinomoto atau gunakan direct built-in system dispatcher.
                        </p>
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">Pilihan Cepat Server (Presets):</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplySmtpPreset('direct')}
                          className={`p-2 rounded-xl text-left border text-[11px] font-bold cursor-pointer transition ${
                            !smtpConfig.enabled
                              ? 'bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>Direct System</span>
                            {!smtpConfig.enabled && <i className="fa-solid fa-check text-blue-600"></i>}
                          </div>
                          <span className="text-[9.5px] font-normal text-slate-500 block mt-0.5">Built-in Dispatch</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApplySmtpPreset('ajinomoto')}
                          className={`p-2 rounded-xl text-left border text-[11px] font-bold cursor-pointer transition ${
                            smtpConfig.enabled && smtpConfig.host.includes('ajinomoto')
                              ? 'bg-amber-50 border-amber-500 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>Ajinomoto Relay</span>
                            {smtpConfig.enabled && smtpConfig.host.includes('ajinomoto') && <i className="fa-solid fa-check text-amber-600"></i>}
                          </div>
                          <span className="text-[9.5px] font-normal text-slate-500 block mt-0.5">mail.ajinomoto.co.id</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApplySmtpPreset('office365')}
                          className={`p-2 rounded-xl text-left border text-[11px] font-bold cursor-pointer transition ${
                            smtpConfig.enabled && smtpConfig.host.includes('office365')
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>Office 365</span>
                            {smtpConfig.enabled && smtpConfig.host.includes('office365') && <i className="fa-solid fa-check text-indigo-600"></i>}
                          </div>
                          <span className="text-[9.5px] font-normal text-slate-500 block mt-0.5">smtp.office365.com</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApplySmtpPreset('gmail')}
                          className={`p-2 rounded-xl text-left border text-[11px] font-bold cursor-pointer transition ${
                            smtpConfig.enabled && smtpConfig.host.includes('gmail')
                              ? 'bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>Gmail / Google</span>
                            {smtpConfig.enabled && smtpConfig.host.includes('gmail') && <i className="fa-solid fa-check text-rose-600"></i>}
                          </div>
                          <span className="text-[9.5px] font-normal text-slate-500 block mt-0.5">smtp.gmail.com</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={smtpConfig.enabled}
                          onChange={(e) => {
                            const updated = { ...smtpConfig, enabled: e.target.checked };
                            setSmtpConfig(updated);
                            saveSmtpConfig(updated);
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span>Gunakan Custom Server SMTP untuk Pengiriman Email</span>
                      </label>

                      {smtpConfig.enabled ? (
                        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">SMTP Host Server:</label>
                              <input
                                type="text"
                                value={smtpConfig.host}
                                onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                                placeholder="misal: smtp.office365.com / mail.ajinomoto.co.id"
                                className="input-elegant w-full px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Port:</label>
                              <input
                                type="number"
                                value={smtpConfig.port}
                                onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) || 587 })}
                                placeholder="587 / 465 / 25"
                                className="input-elegant w-full px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">SMTP Username / Email:</label>
                              <input
                                type="text"
                                value={smtpConfig.user}
                                onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                                placeholder="user@ajinomoto.co.id"
                                className="input-elegant w-full px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">SMTP Password / App Secret:</label>
                              <input
                                type="password"
                                value={smtpConfig.pass}
                                onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                                placeholder="Password atau App Password"
                                className="input-elegant w-full px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Pengirim Resmi (Sender Name):</label>
                              <input
                                type="text"
                                value={smtpConfig.fromName}
                                onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                                placeholder="PT Ajinomoto Indonesia — Mojokerto Factory"
                                className="input-elegant w-full px-3 py-1.5 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Alamat Email Pengirim (From):</label>
                              <input
                                type="email"
                                value={smtpConfig.fromEmail}
                                onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                                placeholder="noreply@ajinomoto.co.id"
                                className="input-elegant w-full px-3 py-1.5 text-xs font-mono"
                              />
                            </div>
                          </div>

                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={smtpConfig.secure}
                              onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                              className="rounded text-indigo-600"
                            />
                            <span>Gunakan SSL/TLS Langsung (Centang jika Port 465)</span>
                          </label>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                          <p className="font-bold text-[#0E2340] dark:text-blue-300 flex items-center gap-1.5">
                            <i className="fa-solid fa-bolt text-amber-500"></i> Mode Pengiriman Otomatis Aktif
                          </p>
                          <p className="text-[11px]">
                            Sistem secara otomatis mengirim email laporan menggunakan server dispatcher backend terintegrasi dengan tanda bukti pengiriman dan pratinjau pesan.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Test result message */}
                    {smtpTestResult && (
                      <div
                        className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                          smtpTestResult.success
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                      >
                        <i className={`fa-solid ${smtpTestResult.success ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                        <span>{smtpTestResult.message}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={handleTestSmtp}
                        disabled={isTestingSmtp || !smtpConfig.host}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isTestingSmtp ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"></span>
                            <span>Menguji Koneksi SMTP...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-plug text-indigo-500"></i>
                            <span>Uji Koneksi Server</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          saveSmtpConfig(smtpConfig);
                          setEmailAlert({ type: 'success', message: 'Konfigurasi SMTP berhasil disimpan ke sistem.' });
                          setActivePreviewPage('email');
                        }}
                        className="btn-navy px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <i className="fa-solid fa-floppy-disk"></i>
                        <span>Simpan &amp; Kembali</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : activePreviewPage === 'history' ? (
                /* EMAIL DISPATCH LOG PANEL */
                <div className="w-full max-w-xl space-y-3 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
                          <i className="fa-solid fa-clock-rotate-left text-amber-500"></i>
                          Riwayat Pengiriman Email Langsung dari Sistem
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Catatan log pengiriman laporan beserta lampiran PDF dan ID pesan.
                        </p>
                      </div>
                      {dispatchHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            clearEmailHistory();
                            setDispatchHistory([]);
                          }}
                          className="text-[11px] text-rose-500 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                        >
                          <i className="fa-solid fa-trash-can text-[10px]"></i> Bersihkan Log
                        </button>
                      )}
                    </div>

                    {dispatchHistory.length === 0 ? (
                      <div className="text-center py-10 space-y-2 text-slate-400">
                        <i className="fa-solid fa-inbox text-3xl"></i>
                        <p className="font-semibold text-xs">Belum ada riwayat pengiriman email.</p>
                        <p className="text-[11px]">Kirim laporan pertama Anda melalui tombol "Kirim Laporan Langsung".</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {dispatchHistory.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[280px]">
                                {item.to}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  item.status === 'SUCCESS'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}
                              >
                                {item.status === 'SUCCESS' ? '✓ TERKIRIM' : 'GAGAL'}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">{item.subject}</p>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              <span>{new Date(item.timestamp).toLocaleString('id-ID')}</span>
                              <div className="flex items-center gap-2">
                                {item.hasPdfAttachment && (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                    <i className="fa-solid fa-paperclip text-[9px]"></i> PDF Terlampir
                                  </span>
                                )}
                                <span className="font-mono">{item.method}</span>
                              </div>
                            </div>

                            {item.previewUrl && (
                              <div className="pt-1">
                                <a
                                  href={item.previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i> Pratinjau Pesan Terkirim (Ethereal)
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : activePreviewPage === 'email' ? (
                /* EMAIL EDITOR & PREVIEW VIEW */
                <div className="w-full max-w-xl space-y-3 animate-fadeIn">
                  {emailViewMode === 'edit' ? (
                    /* EDIT MODE */
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <i className="fa-solid fa-pen text-blue-600"></i> Kustomisasi Redaksional Email Laporan
                        </span>
                        <button
                          type="button"
                          onClick={handleResetEmailToDefault}
                          className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer font-semibold"
                          title="Kembalikan semua teks ke template standar"
                        >
                          <i className="fa-solid fa-arrow-rotate-left text-[10px]"></i> Reset Standar
                        </button>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Penerima (To):</label>
                        <input
                          type="email"
                          value={emailContent.toEmail}
                          onChange={(e) => setEmailContent({ ...emailContent, toEmail: e.target.value })}
                          placeholder="contoh: pimpinan@ajinomoto.co.id, hr.manager@ajinomoto.co.id"
                          className="input-elegant w-full px-3 py-2 text-xs font-semibold"
                        />
                        <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-semibold">Pilihan Cepat:</span>
                            {['pimpinan@ajinomoto.co.id', 'hr.manager@ajinomoto.co.id', 'factory.head@ajinomoto.co.id'].map((em) => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => setEmailContent({ ...emailContent, toEmail: em })}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-700 transition cursor-pointer font-mono"
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAdvancedHeaders(!showAdvancedHeaders)}
                            className="text-[10.5px] font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            {showAdvancedHeaders ? 'Sembunyikan CC/BCC' : '+ Tambah CC / BCC'}
                          </button>
                        </div>
                      </div>

                      {showAdvancedHeaders && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Tembusan (CC):</label>
                            <input
                              type="text"
                              value={emailContent.ccEmail || ''}
                              onChange={(e) => setEmailContent({ ...emailContent, ccEmail: e.target.value })}
                              placeholder="hr.staff@ajinomoto.co.id"
                              className="input-elegant w-full px-2.5 py-1.5 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Blind Carbon Copy (BCC):</label>
                            <input
                              type="text"
                              value={emailContent.bccEmail || ''}
                              onChange={(e) => setEmailContent({ ...emailContent, bccEmail: e.target.value })}
                              placeholder="archive.hr@ajinomoto.co.id"
                              className="input-elegant w-full px-2.5 py-1.5 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subjek Email:</label>
                        <input
                          type="text"
                          value={emailContent.subject}
                          onChange={(e) => setEmailContent({ ...emailContent, subject: e.target.value })}
                          className="input-elegant w-full px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Salam Pembuka / Kepada:</label>
                        <input
                          type="text"
                          value={emailContent.salutation}
                          onChange={(e) => setEmailContent({ ...emailContent, salutation: e.target.value })}
                          className="input-elegant w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Paragraf Pengantar:</label>
                        <textarea
                          rows={3}
                          value={emailContent.mainParagraph}
                          onChange={(e) => setEmailContent({ ...emailContent, mainParagraph: e.target.value })}
                          className="input-elegant w-full px-3 py-2 text-xs text-slate-800 dark:text-slate-100 leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={emailContent.showStatsTable}
                            onChange={(e) => setEmailContent({ ...emailContent, showStatsTable: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          <span>Sertakan Tabel Ringkasan KPI</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={emailContent.showFilterLine}
                            onChange={(e) => setEmailContent({ ...emailContent, showFilterLine: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          <span>Sertakan Badge Filter</span>
                        </label>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan Tambahan (Opsional):</label>
                        <input
                          type="text"
                          value={emailContent.additionalNotes || ''}
                          onChange={(e) => setEmailContent({ ...emailContent, additionalNotes: e.target.value })}
                          placeholder="Misal: Mohon verifikasi divisi MSG sebelum tanggal 10..."
                          className="input-elegant w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kalimat Penutup:</label>
                        <textarea
                          rows={2}
                          value={emailContent.closingParagraph}
                          onChange={(e) => setEmailContent({ ...emailContent, closingParagraph: e.target.value })}
                          className="input-elegant w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tanda Tangan Pengirim:</label>
                        <textarea
                          rows={3}
                          value={emailContent.senderSign}
                          onChange={(e) => setEmailContent({ ...emailContent, senderSign: e.target.value })}
                          className="input-elegant w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-mono"
                        />
                      </div>
                    </div>
                  ) : emailViewMode === 'plain_preview' ? (
                    /* PLAIN TEXT PREVIEW */
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Subjek: {emailDraftPayload.subject}</span>
                        <button
                          type="button"
                          onClick={handleCopyEmailText}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer flex items-center gap-1.5"
                        >
                          <i className={`fa-solid ${copiedEmailText ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                          <span>{copiedEmailText ? 'Tersalin!' : 'Salin Teks'}</span>
                        </button>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-800 max-h-[380px] overflow-y-auto">
                        {emailDraftPayload.plainTextBody}
                      </div>
                    </div>
                  ) : (
                    /* VISUAL HTML PREVIEW (Matches exactly the recipient email view) */
                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md bg-white text-slate-900 text-xs">
                      {/* Email Header */}
                      <div className="p-4 text-white flex items-center gap-3.5" style={{ background: 'linear-gradient(135deg, #0E2340, #16345E)' }}>
                        <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png"
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] tracking-wider text-amber-300 font-bold uppercase">
                            PT AJINOMOTO INDONESIA — MOJOKERTO FACTORY
                          </p>
                          <p className="text-sm font-extrabold text-white">Laporan Multi-Skill Monitoring</p>
                        </div>
                      </div>

                      {/* Email Body Content */}
                      <div className="p-5 space-y-3.5 bg-white text-slate-700">
                        <p className="font-semibold text-slate-900">{emailContent.salutation}</p>
                        <p className="leading-relaxed">{emailContent.mainParagraph}</p>

                        {/* Parameter Badge */}
                        {emailContent.showFilterLine && (
                          <div className="p-2 text-center rounded-xl border border-dashed border-amber-400 bg-amber-50 text-[11px] text-slate-600 font-semibold">
                            Periode: {blnStr} {thnStr} | Divisi: {divStr || 'Semua Divisi'} | Dept: {deptStr || 'Semua Departemen'}
                          </div>
                        )}

                        {/* Summary Table */}
                        {emailContent.showStatsTable && (
                          <div className="border border-slate-200 rounded-xl overflow-hidden my-3">
                            <table className="w-full text-xs text-left">
                              <tbody>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <td className="p-2.5 text-slate-600">Total Karyawan</td>
                                  <td className="p-2.5 text-right font-bold text-slate-900">{totalManpower}</td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <td className="p-2.5 text-slate-600">Standar (MS)</td>
                                  <td className="p-2.5 text-right font-bold text-emerald-600">{totalMS}</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <td className="p-2.5 text-slate-600">Belum Standar (US)</td>
                                  <td className="p-2.5 text-right font-bold text-rose-600">{totalUS}</td>
                                </tr>
                                <tr>
                                  <td className="p-2.5 text-slate-600">Pencapaian</td>
                                  <td className="p-2.5 text-right font-bold text-slate-900">{pctFormatted}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Attached PDF Notice */}
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-900">
                          <i className="fa-solid fa-file-pdf text-rose-600 text-lg shrink-0"></i>
                          <div className="text-[11px]">
                            <strong className="block font-bold text-slate-900">Lampiran Dokumen PDF Resmi (3 Halaman)</strong>
                            <span>Laporan lengkap beserta tanda tangan digital HR Management akan dilampirkan otomatis.</span>
                          </div>
                        </div>

                        {emailContent.additionalNotes && (
                          <div className="p-2.5 rounded-lg bg-slate-100 border-l-4 border-[#0E2340] text-[11px] text-slate-700">
                            <strong>Catatan:</strong> {emailContent.additionalNotes}
                          </div>
                        )}

                        <p className="leading-relaxed">{emailContent.closingParagraph}</p>
                        <div className="pt-2 text-slate-800 whitespace-pre-line font-medium">{emailContent.senderSign}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* 3-PAGE PDF VISUAL PREVIEWS */
                <div className="w-[340px] sm:w-[420px] min-h-[580px] bg-white text-slate-800 rounded-lg shadow-xl border border-slate-300 flex flex-col justify-between overflow-hidden">
                  {/* PDF Top Official Header Banner */}
                  <div className="relative">
                    <div className="p-3 text-white flex items-center justify-between" style={{ backgroundColor: '#0E2340' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-white p-0.5 flex items-center justify-center shrink-0">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png"
                            alt="Logo Ajinomoto"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-[7.5px] tracking-wider text-slate-300 uppercase font-semibold leading-tight">
                            Eat Well, Live Well.
                          </p>
                          <p className="text-[12px] font-extrabold text-white leading-tight">AJINOMOTO MOJOKERTO FACTORY</p>
                          <p className="text-[8px] text-slate-300 leading-tight">
                            Laporan Monitoring Multi-Skill Karyawan &amp; Manajer
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Gold stripe */}
                    <div className="h-1 w-full" style={{ backgroundColor: '#B8874B' }}></div>
                  </div>

                  {/* PDF Content Area Based on Active Preview Page */}
                  <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                    {activePreviewPage === 'page1' && (
                      <div className="space-y-2.5 animate-fadeIn">
                        {/* 4 KPI Cards matching Page 1 */}
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0E2340]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{totalManpower}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Total Karyawan</span>
                          </div>
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0FA968]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{totalMS}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Standar (MS)</span>
                          </div>
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E10600]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{totalUS}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Belum Standar (US)</span>
                          </div>
                          <div className="p-1.5 rounded bg-white border border-slate-200 relative overflow-hidden text-left pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B8874B]"></div>
                            <p className="font-bold text-slate-800 text-[11px] leading-tight">{pctFormatted}</p>
                            <span className="text-[6.5px] text-slate-500 block mt-0.5">Pencapaian</span>
                          </div>
                        </div>

                        {/* Filter Aktif line */}
                        <div className="text-[7.5px] space-y-0.5 pt-0.5">
                          <p className="font-bold text-[#B8874B] uppercase tracking-wide text-[7px]">FILTER AKTIF</p>
                          <p className="text-slate-600">
                            Tahun: {thnStr} | Bulan: {blnStr} | Divisi: {divStr || 'Semua'} | Department: {deptStr || 'Semua'} | Jabatan: {jabStr || 'Semua'}
                          </p>
                        </div>

                        {/* Rekap per Divisi */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                            <p className="font-bold text-[#0E2340] text-[9.5px]">Rekap per Divisi</p>
                          </div>
                          <div className="border border-slate-200 rounded overflow-hidden">
                            <table className="w-full text-[7.5px] text-left">
                              <thead className="bg-[#0E2340] text-white">
                                <tr>
                                  <th className="p-1 pl-1.5">Divisi</th>
                                  <th className="p-1 text-center w-8">MS</th>
                                  <th className="p-1 text-center w-8">US</th>
                                  <th className="p-1 text-center w-9">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {byDivisi.slice(0, 9).map((d, i) => {
                                  const total = d.ms + d.us;
                                  return (
                                    <tr key={d.label} className={i % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}>
                                      <td className="p-0.5 pl-1.5 font-normal text-slate-800 truncate max-w-[140px]">{d.label}</td>
                                      <td className="p-0.5 text-center text-slate-600">{d.ms}</td>
                                      <td className="p-0.5 text-center text-slate-600">{d.us}</td>
                                      <td className="p-0.5 text-center font-normal text-slate-800">{total}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Rekap per Department (Part 1 on Page 1) */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                            <p className="font-bold text-[#0E2340] text-[9.5px]">Rekap per Department</p>
                          </div>
                          <div className="border border-slate-200 rounded overflow-hidden">
                            <table className="w-full text-[7.5px] text-left">
                              <thead className="bg-[#0E2340] text-white">
                                <tr>
                                  <th className="p-1 pl-1.5">Department</th>
                                  <th className="p-1 text-center w-8">MS</th>
                                  <th className="p-1 text-center w-8">US</th>
                                  <th className="p-1 text-center w-9">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {byDepartment.slice(0, 7).map((d, i) => {
                                  const total = d.ms + d.us;
                                  return (
                                    <tr key={d.label} className={i % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}>
                                      <td className="p-0.5 pl-1.5 font-normal text-slate-800 truncate max-w-[140px]">{d.label}</td>
                                      <td className="p-0.5 text-center text-slate-600">{d.ms}</td>
                                      <td className="p-0.5 text-center text-slate-600">{d.us}</td>
                                      <td className="p-0.5 text-center font-normal text-slate-800">{total}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePreviewPage === 'page2' && (
                      <div className="space-y-2.5 animate-fadeIn">
                        {/* Rekap per Department continuation */}
                        <div className="border border-slate-200 rounded overflow-hidden">
                          <table className="w-full text-[7.5px] text-left">
                            <thead className="bg-[#0E2340] text-white">
                              <tr>
                                <th className="p-1 pl-1.5">Department (Lanjutan)</th>
                                <th className="p-1 text-center w-8">MS</th>
                                <th className="p-1 text-center w-8">US</th>
                                <th className="p-1 text-center w-9">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(byDepartment.length > 7 ? byDepartment.slice(7, 12) : byDepartment.slice(0, 5)).map((d, i) => {
                                const total = d.ms + d.us;
                                return (
                                  <tr key={d.label} className={i % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}>
                                    <td className="p-0.5 pl-1.5 font-normal text-slate-800 truncate max-w-[140px]">{d.label}</td>
                                    <td className="p-0.5 text-center text-slate-600">{d.ms}</td>
                                    <td className="p-0.5 text-center text-slate-600">{d.us}</td>
                                    <td className="p-0.5 text-center font-normal text-slate-800">{total}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Rekap per Grade */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                            <p className="font-bold text-[#0E2340] text-[9.5px]">Rekap per Grade</p>
                          </div>
                          <div className="border border-slate-200 rounded overflow-hidden">
                            <table className="w-full text-[7.5px] text-left">
                              <thead className="bg-[#0E2340] text-white">
                                <tr>
                                  <th className="p-1 pl-1.5">Grade</th>
                                  <th className="p-1 text-center w-8">MS</th>
                                  <th className="p-1 text-center w-8">US</th>
                                  <th className="p-1 text-center w-9">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {byGrade.slice(0, 8).map((d, i) => {
                                  const total = d.ms + d.us;
                                  return (
                                    <tr key={d.label} className={i % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}>
                                      <td className="p-0.5 pl-1.5 font-normal text-slate-800">{d.label}</td>
                                      <td className="p-0.5 text-center text-slate-600">{d.ms}</td>
                                      <td className="p-0.5 text-center text-slate-600">{d.us}</td>
                                      <td className="p-0.5 text-center font-normal text-slate-800">{total}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Rekap per Job Position */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                            <p className="font-bold text-[#0E2340] text-[9.5px]">Rekap per Job Position</p>
                          </div>
                          <div className="border border-slate-200 rounded overflow-hidden">
                            <table className="w-full text-[7px] text-left">
                              <thead className="bg-[#0E2340] text-white">
                                <tr>
                                  <th className="p-1 pl-1.5">Job Position</th>
                                  <th className="p-1 text-center">Threshold</th>
                                  <th className="p-1 text-center">Target (%)</th>
                                  <th className="p-1 text-center">OK</th>
                                  <th className="p-1 text-center">Not OK</th>
                                  <th className="p-1 text-center">Manpower</th>
                                  <th className="p-1 text-center">Result (%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {byPosition.map((d, i) => (
                                  <tr key={d.key} className={i % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}>
                                    <td className="p-0.5 pl-1.5 font-medium text-slate-800">{d.label}</td>
                                    <td className="p-0.5 text-center text-slate-600">{d.threshold}</td>
                                    <td className="p-0.5 text-center text-slate-600">{(d.target * 100).toFixed(1)}</td>
                                    <td className="p-0.5 text-center text-slate-600">{d.ok}</td>
                                    <td className="p-0.5 text-center text-slate-600">{d.notOk}</td>
                                    <td className="p-0.5 text-center font-medium text-slate-800">{d.manpower}</td>
                                    <td className="p-0.5 text-center font-medium text-slate-800">{(d.resultPercent * 100).toFixed(1)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePreviewPage === 'page3' && (
                      <div className="space-y-3 animate-fadeIn flex flex-col justify-start pt-3">
                        <div className="self-end w-48 space-y-1 text-right">
                          <p className="text-[7.5px] text-slate-600">
                            Mojokerto, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-[7.5px] text-slate-600">Mengetahui,</p>
                          <p className="text-[8.5px] font-bold text-[#0E2340]">HR Management</p>

                          {/* Dashed E-Sign Box */}
                          <div className="p-2.5 rounded-lg border border-dashed border-[#B8874B] bg-white text-left space-y-1.5 shadow-xs my-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-[#B8874B] text-white flex items-center justify-center text-[7px] font-bold">
                                ✓
                              </span>
                              <span className="text-[8.5px] font-bold text-[#B8874B]">E-SIGNED</span>
                            </div>
                            <div className="text-[6.5px] text-slate-500 leading-tight space-y-0.5">
                              <p>Ditandatangani elektronik</p>
                              <p>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                              <p>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                            </div>
                          </div>

                          <div className="text-left pt-1">
                            <p className="font-bold text-slate-800 text-[8.5px]">( {signerName} )</p>
                            <p className="text-[7px] text-slate-500">{signerRole}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PDF Preview Footer */}
                    <div className="pt-2 border-t text-[7.5px] text-slate-400 flex items-center justify-between">
                      <span>Sistem Multi-Skill Monitoring &bull; PT Ajinomoto Indonesia</span>
                      <span>
                        {activePreviewPage === 'page1' && 'Halaman 1 / 3'}
                        {activePreviewPage === 'page2' && 'Halaman 2 / 3'}
                        {activePreviewPage === 'page3' && 'Halaman 3 / 3'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3 bg-white dark:bg-slate-900">
          {/* Quick Direct Email Sending Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                  <i className="fa-solid fa-paper-plane"></i>
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span>Kirim Laporan Resmi Langsung dari Sistem</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full font-bold">
                      + Lampiran PDF Otomatis
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pengirim: <strong className="text-slate-700 dark:text-slate-200">{currentUser.email || 'mahmudnurdiansyah4@gmail.com'}</strong> ({signerName})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivePreviewPage('email');
                    setEmailViewMode('edit');
                  }}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                  <span>Edit Redaksional</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('smtp')}
                  className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-gear text-[10px]"></i>
                  <span>Pengaturan SMTP</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('history')}
                  className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
                  <span>Riwayat Pengiriman</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative flex-1 min-w-[260px]">
                <i className="fa-solid fa-at absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="email"
                  value={emailContent.toEmail}
                  onChange={(e) => setEmailContent({ ...emailContent, toEmail: e.target.value })}
                  placeholder="Masukkan alamat email pimpinan/tujuan (contoh: pimpinan@ajinomoto.co.id)..."
                  className="input-elegant w-full pl-8 pr-3 py-2 outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              {/* TOMBOL KIRIM LANGSUNG DARI SYSTEM */}
              <button
                type="button"
                onClick={handleSendEmailDirect}
                disabled={isSendingEmail}
                className="btn-navy px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60 shadow-md hover:opacity-95 bg-gradient-to-r from-[#0E2340] to-[#1E4976] text-amber-300 border border-amber-400/30"
              >
                {isSendingEmail ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin"></span>
                    <span>{emailSendingStep || 'Mengirim Laporan...'}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane text-xs text-amber-400"></i>
                    <span>Kirim Langsung dari Sistem</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {emailAlert && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
                emailAlert.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${emailAlert.type === 'success' ? 'fa-circle-check text-emerald-600 text-sm' : 'fa-circle-exclamation text-rose-600 text-sm'}`}></i>
                <span>{emailAlert.message}</span>
              </div>
              {emailAlert.previewUrl && (
                <a
                  href={emailAlert.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600 dark:text-blue-400 font-bold shrink-0 ml-2"
                >
                  Lihat Pratinjau Server
                </a>
              )}
            </div>
          )}

          {/* Bottom Controls: Download PDF or Close */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-shield-halved text-emerald-600"></i>
              <span>Dokumen tervalidasi digital &bull; Mojokerto Factory</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all bg-red-600 hover:bg-red-700 text-white active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Menyiapkan PDF...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-arrow-down text-sm"></i>
                    <span>Download Laporan PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert Modal */}
      <ConfirmationModal
        isOpen={Boolean(errorModalMsg)}
        title="Gagal Menghasilkan Dokumen PDF"
        description={errorModalMsg || ''}
        confirmLabel="Tutup"
        variant="danger"
        icon="fa-solid fa-triangle-exclamation"
        singleAction={true}
        onConfirm={() => setErrorModalMsg(null)}
        onCancel={() => setErrorModalMsg(null)}
      />
    </div>
  );
};
