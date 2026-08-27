import React, { useState, useEffect } from 'react';
import { Employee, AppFiltersState, UserSession } from '../types';
import { generateMultiSkillReportPdf } from '../utils/pdfExport';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from '../utils/storage';
import { ConfirmationModal } from './ConfirmationModal';
import {
  EmailCustomContent,
  getDefaultEmailContent,
  buildMultiSkillEmailDraft,
  sendMultiSkillEmailReport,
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

  // Preview tab state: 'page1' | 'page2' | 'page3' | 'roster' | 'email'
  const [activePreviewPage, setActivePreviewPage] = useState<'page1' | 'page2' | 'page3' | 'roster' | 'email'>('page1');

  // Email Drawer / Editor state
  const [isEmailRowOpen, setIsEmailRowOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  
  // Editable Email Content
  const [emailContent, setEmailContent] = useState<EmailCustomContent>(() =>
    getDefaultEmailContent({
      targetData: filteredEmployees,
      filters,
      toEmail: 'pimpinan@ajinomoto.co.id'
    })
  );

  // Email view sub-mode: 'edit' | 'visual_preview' | 'plain_preview'
  const [emailViewMode, setEmailViewMode] = useState<'edit' | 'visual_preview' | 'plain_preview'>('visual_preview');

  // Webhook configuration
  const [emailWebhookUrl, setEmailWebhookUrlState] = useState(getSavedEmailWebhookUrl());
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  // Loading generation state
  const [isGenerating, setIsGenerating] = useState(false);

  // PDF Generation Error Modal State
  const [errorModalMsg, setErrorModalMsg] = useState<string | null>(null);

  // Sync email default content when filters or scope change
  useEffect(() => {
    const targetData = scope === 'filtered' ? filteredEmployees : allEmployees;
    const defaults = getDefaultEmailContent({ targetData, filters, toEmail: emailContent.toEmail });
    // Update only if user hasn't heavily modified, or keep user edits
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
    } catch (_) {
      // Fallback
    }
  };

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
    }, 400);
  };

  const handleSendEmail = async () => {
    setEmailAlert(null);
    if (!emailContent.toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContent.toEmail.trim())) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima / pimpinan yang valid.' });
      return;
    }

    setIsSendingEmail(true);
    const payload = buildMultiSkillEmailDraft({
      targetData,
      filters,
      currentUser,
      customContent: emailContent
    });

    const res = await sendMultiSkillEmailReport(payload);
    setIsSendingEmail(false);

    if (res.success) {
      setEmailAlert({
        type: 'success',
        message: res.message
      });
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch (_) {}
    } else {
      setEmailAlert({
        type: 'error',
        message: res.message
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-50 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #0E2340, #16345E)' }}
            >
              <i className="fa-solid fa-file-pdf text-amber-400 text-lg"></i>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Pratinjau &amp; Distribusi Laporan Multi-Skill</span>
                <span className="badge-pill bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] px-2 py-0.5 font-bold">
                  E-SIGN OFFICIAL
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PT Ajinomoto Indonesia &bull; Mojokerto Factory &bull; Format 3 Halaman Eksekutif &amp; Redaksional Email
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

            {/* Report Structure Information */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
              <p className="font-bold text-[#0E2340] dark:text-blue-300 flex items-center gap-1.5">
                <i className="fa-solid fa-layer-group text-blue-600"></i>
                Struktur Dokumen Laporan Resmi:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11.5px] text-slate-600 dark:text-slate-400 pl-1">
                <li><strong>Halaman 1:</strong> Kop Surat Banner Navy, Rekap KPI, Breakdown Divisi &amp; Dept.</li>
                <li><strong>Halaman 2:</strong> Rekapitulasi per Grade &amp; Kategori Job Position.</li>
                <li><strong>Halaman 3:</strong> Lembar Pengesahan Validasi Digital E-Sign HR Management.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Interactive Live Preview & Email Editor (7 Cols) */}
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
                  onClick={() => {
                    setActivePreviewPage('email');
                    setIsEmailRowOpen(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activePreviewPage === 'email'
                      ? 'bg-[#0E2340] text-amber-300 shadow-sm'
                      : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                  }`}
                >
                  <i className="fa-regular fa-envelope text-[11px]"></i>
                  <span>Redaksional Email</span>
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
                    <i className="fa-solid fa-pen-to-square text-[10px] mr-1"></i>Edit
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

            {/* Preview Sheet Canvas / Email Viewer */}
            <div className="flex-1 overflow-y-auto mt-3 p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-center">
              {activePreviewPage === 'email' ? (
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
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
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
                      </div>

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
                          <span>Sertakan Tabel Statistik</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={emailContent.showFilterLine}
                            onChange={(e) => setEmailContent({ ...emailContent, showFilterLine: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          <span>Sertakan Badge Parameter</span>
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
                          <p className="text-[10px] tracking-wider text-slate-200 font-bold uppercase">
                            PT AJINOMOTO INDONESIA — MOJOKERTO FACTORY
                          </p>
                          <p className="text-sm font-extrabold text-white">Laporan Multi-Skill Monitoring</p>
                        </div>
                      </div>

                      {/* Email Body Content */}
                      <div className="p-5 space-y-3.5 bg-white text-slate-700">
                        <p className="font-semibold text-slate-900">{emailContent.salutation}</p>
                        <p className="leading-relaxed">{emailContent.mainParagraph}</p>

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

                        {emailContent.showFilterLine && (
                          <div className="p-2 text-center rounded-xl border border-dashed border-amber-400 bg-amber-50 text-[11px] text-slate-600 font-semibold">
                            Periode: {blnStr} {thnStr} | Divisi: {divStr || 'Semua Divisi'} | Dept: {deptStr || 'Semua Departemen'}
                          </div>
                        )}

                        {emailContent.additionalNotes && (
                          <div className="p-2.5 rounded-lg bg-slate-100 border-l-4 border-[#0E2340] text-[11px] text-slate-700">
                            <strong>Catatan:</strong> {emailContent.additionalNotes}
                          </div>
                        )}

                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Laporan ini dihasilkan secara otomatis oleh sistem pada {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, sebagai bagian dari proses monitoring kompetensi multi-skill karyawan di lingkungan Ajinomoto Mojokerto Factory.
                        </p>

                        <p className="text-xs text-slate-600">{emailContent.closingParagraph}</p>

                        <div className="pt-3 border-t border-slate-200 text-xs leading-relaxed">
                          <p className="text-slate-500">Hormat kami,</p>
                          <p className="font-extrabold text-[#0E2340]">Sistem Multi-Skill Monitoring</p>
                          <p className="text-slate-600">HR Development Section</p>
                          <p className="text-slate-600">PT Ajinomoto Indonesia — Mojokerto Factory</p>
                        </div>
                      </div>

                      {/* Email Footer */}
                      <div className="p-3 bg-slate-100 border-t border-slate-200 text-[10.5px] text-slate-400 text-center">
                        Email ini dikirimkan secara otomatis oleh sistem, mohon tidak membalas ke alamat ini.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* PDF DOCUMENT PREVIEW CANVAS */
                <div className="w-full max-w-md bg-white text-slate-800 shadow-lg rounded-xl border border-slate-300 overflow-hidden flex flex-col text-[10px] min-h-[480px]">
                  {/* Page Top Kop Banner */}
                  <div className="p-3 text-white" style={{ background: 'linear-gradient(135deg, #0E2340, #16345E)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[8px] tracking-wider text-amber-300 font-bold uppercase">
                          PT AJINOMOTO INDONESIA &bull; MOJOKERTO FACTORY
                        </p>
                        <h4 className="text-xs font-bold text-white mt-0.5">LAPORAN MONITORING MULTI-SKILL</h4>
                        <p className="text-[8px] text-slate-300">
                          Periode: {blnStr} {thnStr} &bull; Dicetak: {new Date().toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center">
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png"
                          alt="Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="h-1 bg-amber-500 w-full"></div>

                  {/* Page Body Preview */}
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
          {/* Email Quick Row Drawer */}
          {isEmailRowOpen && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                    <i className="fa-solid fa-paper-plane"></i>
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Pengiriman Laporan Resmi Multi-Skill Monitoring
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
                    onClick={handleCopyEmailText}
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <i className={`fa-solid ${copiedEmailText ? 'fa-check text-emerald-600' : 'fa-copy text-[10px]'}`}></i>
                    <span>{copiedEmailText ? 'Tersalin' : 'Salin Pesan'}</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                  <button
                    type="button"
                    onClick={() => setShowWebhookConfig(!showWebhookConfig)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-solid fa-gear text-[10px]"></i>
                    <span>Webhook Server</span>
                  </button>
                </div>
              </div>

              {/* Webhook Configuration Panel (Optional) */}
              {showWebhookConfig && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    URL Webhook Email Server (Opsional untuk pengiriman direct serverless):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={emailWebhookUrl}
                      onChange={(e) => setEmailWebhookUrlState(e.target.value)}
                      placeholder="https://your-email-server.example.com/api/send"
                      className="input-elegant flex-1 px-3 py-1.5 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        saveEmailWebhookUrl(emailWebhookUrl);
                        setEmailAlert({ type: 'success', message: 'URL Webhook Email Server berhasil disimpan.' });
                      }}
                      className="btn-navy px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Simpan
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Jika webhook kosong, sistem akan langsung membuka client email/Gmail resmi dengan subjek dan teks redaksional yang sudah Anda sesuaikan.
                  </p>
                </div>
              )}

              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="email"
                  value={emailContent.toEmail}
                  onChange={(e) => setEmailContent({ ...emailContent, toEmail: e.target.value })}
                  placeholder="Masukkan alamat email pimpinan/tujuan (contoh: pimpinan@ajinomoto.co.id)..."
                  className="input-elegant flex-1 min-w-[260px] px-3 py-2 outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="btn-navy px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60 shadow-sm hover:opacity-95"
                >
                  {isSendingEmail ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Mengirim Laporan...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane text-xs"></i>
                      <span>Kirim Laporan Resmi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {emailAlert && (
            <div
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-2 ${
                emailAlert.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
              }`}
            >
              <i className={`fa-solid ${emailAlert.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
              <span>{emailAlert.message}</span>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEmailRowOpen(!isEmailRowOpen)}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0E2340] dark:hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-regular fa-envelope"></i>
              <span>{isEmailRowOpen ? 'Tutup Opsi Email' : 'Kirim via Email Pimpinan'}</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
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
