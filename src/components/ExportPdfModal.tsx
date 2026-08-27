import React, { useState } from 'react';
import { Employee, AppFiltersState, UserSession } from '../types';
import { generateMultiSkillReportPdf } from '../utils/pdfExport';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from '../utils/storage';
import { ConfirmationModal } from './ConfirmationModal';
import { buildGasEmailDraft, sendMultiSkillEmailReport, getSavedGasWebhookUrl, saveGasWebhookUrl } from '../utils/gasEmailService';
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
  const [signerName, setSignerName] = useState(currentUser.name || 'Team HR');
  const [signerRole, setSignerRole] = useState(currentUser.role || 'Admin');

  // Preview tab state: 'page1' | 'page2' | 'page3' | 'roster'
  const [activePreviewPage, setActivePreviewPage] = useState<'page1' | 'page2' | 'page3' | 'roster'>('page1');

  // Email simulation / real GAS webhook state
  const [isEmailRowOpen, setIsEmailRowOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [gasWebhookUrl, setGasWebhookUrlState] = useState(getSavedGasWebhookUrl());
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  // Loading generation state
  const [isGenerating, setIsGenerating] = useState(false);

  // PDF Generation Error Modal State
  const [errorModalMsg, setErrorModalMsg] = useState<string | null>(null);

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

  const emailDraftPayload = buildGasEmailDraft({
    toEmail: emailInput || 'pimpinan@ajinomoto.co.id',
    targetData,
    filters,
    currentUser,
    signerName,
    signerRole
  });

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

        const msg = `Berhasil mengunduh dokumen Laporan PDF (${result.pageCount} Halaman, ${result.rowCount} Karyawan) dengan format resmi Ajinomoto GAS.`;
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
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      setEmailAlert({ type: 'error', message: 'Masukkan alamat email penerima / pimpinan yang valid.' });
      return;
    }

    setIsSendingEmail(true);
    const payload = buildGasEmailDraft({
      toEmail: emailInput.trim(),
      targetData,
      filters,
      currentUser,
      signerName,
      signerRole
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
    <div className="fixed inset-0 z-[100] overflow-y-auto pt-8 pb-8 sm:pt-12 sm:pb-12 px-3 sm:px-6 flex items-start sm:items-center justify-center animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 dark:bg-black/85 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div className="relative modal-panel bg-white dark:bg-slate-900 w-full max-w-4xl my-auto max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl z-10 border border-slate-200 dark:border-slate-800 animate-scaleUp">
        {/* Header Letterhead */}
        <div className="modal-header px-5 sm:px-6 py-4 flex items-start justify-between shrink-0 bg-gradient-to-r from-[#0E2340] via-[#173866] to-[#0E2340] text-white">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 px-2 rounded bg-red-600 text-white font-black text-[9px] flex items-center justify-center tracking-wider">
                AJINOMOTO
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">
                GAS System Standard Report
              </span>
            </div>
            <h3 className="font-display font-extrabold text-base sm:text-lg text-white flex items-center gap-2 flex-wrap">
              <span>Laporan Monitoring Multi-Skill Karyawan &amp; Manajer</span>
              <span className="badge-pill bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] px-2 py-0.5 font-bold">
                E-SIGNED
              </span>
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              Format, tata letak, dan struktur data identik 100% dengan dokumen Google Apps Script (GAS) Mojokerto Factory.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white h-8 w-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 shrink-0 transition cursor-pointer"
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            {/* 1. Cakupan Data */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cakupan Data:
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="input-elegant w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800"
              >
                <option value="filtered">Data Terfilter Saat Ini ({filteredEmployees.length} Karyawan)</option>
                <option value="all">Seluruh Database Master ({allEmployees.length} Karyawan)</option>
              </select>
            </div>

            {/* 2. Format / Tipe */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Format Laporan:
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="input-elegant w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800"
              >
                <option value="comprehensive">GAS Report Lengkap (3 Halaman + E-Sign)</option>
                <option value="employee_detail">Sertakan Detail Roster Karyawan</option>
              </select>
            </div>

            {/* 3. Penandatangan (E-Sign) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pejabat Penandatangan:
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Team HR / Nama Pejabat"
                className="input-elegant w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Interactive Document Simulator (Simulasi Kertas Laporan GAS) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-3 sm:p-4 space-y-3">
            {/* Sheet Page Navigation Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <i className="fa-solid fa-file-pdf text-red-600"></i>
                <span>Simulasi Lembar PDF (GAS Format):</span>
              </span>

              <div className="flex gap-1 bg-white dark:bg-slate-850 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('page1')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    activePreviewPage === 'page1'
                      ? 'bg-[#0E2340] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Halaman 1
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('page2')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    activePreviewPage === 'page2'
                      ? 'bg-[#0E2340] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Halaman 2
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewPage('page3')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    activePreviewPage === 'page3'
                      ? 'bg-[#0E2340] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Halaman 3 (E-Sign)
                </button>
                {reportType === 'employee_detail' && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewPage('roster')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      activePreviewPage === 'roster'
                        ? 'bg-[#0E2340] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Roster Karyawan
                  </button>
                )}
              </div>
            </div>

            {/* Paper Container */}
            <div className="bg-white text-slate-900 rounded-lg shadow-lg border border-slate-300 overflow-hidden font-sans text-xs min-h-[460px] flex flex-col justify-between">
              <div>
                {/* ================= PAGE 1 PREVIEW ================= */}
                {activePreviewPage === 'page1' && (
                  <div className="animate-fadeIn">
                    {/* Header Banner */}
                    <div className="bg-[#0E2340] text-white px-5 py-3.5 relative">
                      <div className="flex items-center gap-3">
                        {/* Logo */}
                        <div className="shrink-0 flex flex-col items-center">
                          <span className="text-[7px] text-white/90 italic">Eat Well, Live Well.</span>
                          <div className="bg-red-600 text-white rounded px-2 py-0.5 font-bold text-xs flex items-center justify-center">
                            Aj
                          </div>
                          <span className="text-[6px] font-black tracking-tighter text-white">AJINOMOTO</span>
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                            AJINOMOTO MOJOKERTO FACTORY
                          </h4>
                          <p className="text-[10px] text-slate-200">
                            Laporan Monitoring Multi-Skill Karyawan &amp; Manajer
                          </p>
                        </div>
                      </div>
                      {/* Gold bottom stripe */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#B8874B]" />
                    </div>

                    <div className="p-4 space-y-3.5">
                      {/* 4 KPI Cards */}
                      <div className="grid grid-cols-4 gap-2">
                        {/* Card 1 */}
                        <div className="bg-white rounded border border-slate-200 p-2 relative overflow-hidden shadow-2xs">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0E2340]" />
                          <div className="pl-1">
                            <p className="text-base font-black text-slate-900 leading-tight">{totalManpower}</p>
                            <p className="text-[9px] text-slate-500 font-semibold">Total Karyawan</p>
                          </div>
                        </div>
                        {/* Card 2 */}
                        <div className="bg-white rounded border border-slate-200 p-2 relative overflow-hidden shadow-2xs">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#10B981]" />
                          <div className="pl-1">
                            <p className="text-base font-black text-slate-900 leading-tight">{totalMS}</p>
                            <p className="text-[9px] text-slate-500 font-semibold">Standar (MS)</p>
                          </div>
                        </div>
                        {/* Card 3 */}
                        <div className="bg-white rounded border border-slate-200 p-2 relative overflow-hidden shadow-2xs">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#EF4444]" />
                          <div className="pl-1">
                            <p className="text-base font-black text-slate-900 leading-tight">{totalUS}</p>
                            <p className="text-[9px] text-slate-500 font-semibold">Belum Standar (US)</p>
                          </div>
                        </div>
                        {/* Card 4 */}
                        <div className="bg-white rounded border border-slate-200 p-2 relative overflow-hidden shadow-2xs">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B8874B]" />
                          <div className="pl-1">
                            <p className="text-base font-black text-slate-900 leading-tight">{pctFormatted}</p>
                            <p className="text-[9px] text-slate-500 font-semibold">Pencapaian</p>
                          </div>
                        </div>
                      </div>

                      {/* Filter Aktif Line */}
                      <div className="text-[10px]">
                        <p className="font-bold text-[#B8874B]">FILTER AKTIF</p>
                        <p className="text-slate-700">
                          Tahun: {thnStr} | Bulan: {blnStr} | Divisi: {divStr} | Department: {deptStr} | Jabatan: {jabStr}
                        </p>
                      </div>

                      {/* Rekap per Divisi Table */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                          <h5 className="font-bold text-xs text-slate-900">Rekap per Divisi</h5>
                        </div>
                        <table className="w-full text-[10px] border-collapse">
                          <thead className="bg-[#0E2340] text-white">
                            <tr>
                              <th className="p-1 text-left font-bold pl-2">Divisi</th>
                              <th className="p-1 text-center font-bold w-12">MS</th>
                              <th className="p-1 text-center font-bold w-12">US</th>
                              <th className="p-1 text-center font-bold w-12 pr-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byDivisi.slice(0, 5).map((d, i) => (
                              <tr key={i} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                                <td className="p-1 pl-2 text-slate-800">{d.label}</td>
                                <td className="p-1 text-center">{d.ms}</td>
                                <td className="p-1 text-center">{d.us}</td>
                                <td className="p-1 text-center pr-2 font-semibold">{d.ms + d.us}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Rekap per Department Table Preview */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                          <h5 className="font-bold text-xs text-slate-900">Rekap per Department</h5>
                        </div>
                        <table className="w-full text-[10px] border-collapse">
                          <thead className="bg-[#0E2340] text-white">
                            <tr>
                              <th className="p-1 text-left font-bold pl-2">Department</th>
                              <th className="p-1 text-center font-bold w-12">MS</th>
                              <th className="p-1 text-center font-bold w-12">US</th>
                              <th className="p-1 text-center font-bold w-12 pr-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byDepartment.slice(0, 4).map((d, i) => (
                              <tr key={i} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                                <td className="p-1 pl-2 text-slate-800">{d.label}</td>
                                <td className="p-1 text-center">{d.ms}</td>
                                <td className="p-1 text-center">{d.us}</td>
                                <td className="p-1 text-center pr-2 font-semibold">{d.ms + d.us}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= PAGE 2 PREVIEW ================= */}
                {activePreviewPage === 'page2' && (
                  <div className="p-4 space-y-4 animate-fadeIn">
                    {/* Rekap per Grade */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                        <h5 className="font-bold text-xs text-slate-900">Rekap per Grade</h5>
                      </div>
                      <table className="w-full text-[10px] border-collapse">
                        <thead className="bg-[#0E2340] text-white">
                          <tr>
                            <th className="p-1 text-left font-bold pl-2">Grade</th>
                            <th className="p-1 text-center font-bold w-12">MS</th>
                            <th className="p-1 text-center font-bold w-12">US</th>
                            <th className="p-1 text-center font-bold w-12 pr-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['M5', 'M4', 'M3', 'M2', 'M1', 'ST5', 'ST4', 'ST3'].map((gr, i) => {
                            const found = byGrade.find((g) => g.label === gr) || { ms: 0, us: 0 };
                            return (
                              <tr key={i} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                                <td className="p-1 pl-2 font-semibold text-slate-800">{gr}</td>
                                <td className="p-1 text-center">{found.ms}</td>
                                <td className="p-1 text-center">{found.us}</td>
                                <td className="p-1 text-center pr-2 font-semibold">{found.ms + found.us}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Rekap per Job Position */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-[#B8874B] inline-block"></span>
                        <h5 className="font-bold text-xs text-slate-900">Rekap per Job Position</h5>
                      </div>
                      <table className="w-full text-[10px] border-collapse">
                        <thead className="bg-[#0E2340] text-white">
                          <tr>
                            <th className="p-1 text-left font-bold pl-2">Job Position</th>
                            <th className="p-1 text-center font-bold">Threshold</th>
                            <th className="p-1 text-center font-bold">Target (%)</th>
                            <th className="p-1 text-center font-bold">OK</th>
                            <th className="p-1 text-center font-bold">Not OK</th>
                            <th className="p-1 text-center font-bold">Manpower</th>
                            <th className="p-1 text-center font-bold pr-2">Result (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byPosition.map((p, i) => (
                            <tr key={i} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                              <td className="p-1 pl-2 font-semibold text-slate-800">{p.label}</td>
                              <td className="p-1 text-center">{p.threshold}</td>
                              <td className="p-1 text-center">{(p.target * 100).toFixed(1)}</td>
                              <td className="p-1 text-center">{p.ok}</td>
                              <td className="p-1 text-center">{p.notOk}</td>
                              <td className="p-1 text-center">{p.manpower}</td>
                              <td className="p-1 text-center pr-2 font-bold">{(p.resultPercent * 100).toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ================= PAGE 3 PREVIEW (E-SIGN) ================= */}
                {activePreviewPage === 'page3' && (
                  <div className="p-6 flex flex-col items-end animate-fadeIn space-y-2">
                    <div className="text-right text-[11px] text-slate-700 space-y-1">
                      <p>Mojokerto, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p>Mengetahui,</p>
                      <p className="font-extrabold text-xs text-[#0E2340]">HR Management</p>
                    </div>

                    {/* Dashed E-Sign Box */}
                    <div className="w-56 p-3 rounded-lg border-2 border-dashed border-[#B8874B] bg-amber-50/20 text-center space-y-1 my-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#B8874B] text-white font-bold text-xs flex items-center justify-center">
                          ✓
                        </span>
                        <span className="font-extrabold text-xs text-[#B8874B] tracking-wider">
                          E-SIGNED
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Ditandatangani elektronik</p>
                      <p className="text-[10px] text-slate-600 font-semibold">
                        {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </p>
                    </div>

                    <div className="text-right text-[11px]">
                      <p className="font-extrabold text-slate-900">( {signerName} )</p>
                      <p className="text-slate-500">{signerRole}</p>
                    </div>
                  </div>
                )}

                {/* ================= ROSTER PREVIEW (OPTIONAL) ================= */}
                {activePreviewPage === 'roster' && (
                  <div className="p-4 space-y-2 animate-fadeIn">
                    <p className="font-bold text-xs text-[#0E2340]">
                      Sample Roster Karyawan ({targetData.slice(0, 6).length} dari {targetData.length} Karyawan):
                    </p>
                    <table className="w-full text-[10px] border-collapse">
                      <thead className="bg-[#0E2340] text-white">
                        <tr>
                          <th className="p-1 pl-2 text-left">Emp ID</th>
                          <th className="p-1 text-left">Nama</th>
                          <th className="p-1 text-left">Jabatan</th>
                          <th className="p-1 text-center">Skor</th>
                          <th className="p-1 text-center">Std</th>
                          <th className="p-1 text-center pr-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetData.slice(0, 6).map((e, idx) => (
                          <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="p-1 pl-2 font-mono font-bold">{e.empId}</td>
                            <td className="p-1 font-semibold">{e.empName}</td>
                            <td className="p-1">{e.jabatan}</td>
                            <td className="p-1 text-center font-bold">{e.totalScore}</td>
                            <td className="p-1 text-center">{e.standard !== null ? `≥ ${e.standard}` : '-'}</td>
                            <td className="p-1 text-center pr-2 font-bold">
                              <span className={e.result === 'MS' ? 'text-emerald-600' : 'text-rose-600'}>
                                {e.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sheet Page Footer */}
              <div className="border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[9px] text-slate-400">
                <span>Sistem Multi-Skill Monitoring – Ajinomoto Mojokerto Factory</span>
                <span>
                  {activePreviewPage === 'page1' && 'Halaman 1 / 3'}
                  {activePreviewPage === 'page2' && 'Halaman 2 / 3'}
                  {activePreviewPage === 'page3' && 'Halaman 3 / 3'}
                  {activePreviewPage === 'roster' && 'Halaman Detail Roster'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3 bg-white dark:bg-slate-900">
          {/* Optional Email Row */}
          {isEmailRowOpen && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                    <i className="fa-solid fa-paper-plane"></i>
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Pengiriman Laporan Resmi Standar GAS (Google Apps Script)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Email Pengirim: <strong className="text-slate-700 dark:text-slate-200">{currentUser.email || 'mahmudnurdiansyah4@gmail.com'}</strong> ({signerName})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailPreview(!showEmailPreview)}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-regular fa-eye text-[10px]"></i>
                    <span>{showEmailPreview ? 'Sembunyikan Draf' : 'Lihat Redaksional Email'}</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                  <button
                    type="button"
                    onClick={() => setShowWebhookConfig(!showWebhookConfig)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-solid fa-gear text-[10px]"></i>
                    <span>GAS Webhook</span>
                  </button>
                </div>
              </div>

              {/* Webhook Configuration Panel (Optional) */}
              {showWebhookConfig && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    URL Webhook Google Apps Script (Opsional untuk pengiriman direct serverless):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={gasWebhookUrl}
                      onChange={(e) => setGasWebhookUrlState(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="input-elegant flex-1 px-3 py-1.5 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        saveGasWebhookUrl(gasWebhookUrl);
                        setEmailAlert({ type: 'success', message: 'URL Webhook Google Apps Script berhasil disimpan.' });
                      }}
                      className="btn-navy px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Simpan
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    Jika webhook kosong, sistem akan langsung membuka client email/Gmail resmi dengan subjek dan format redaksional standar GAS.
                  </p>
                </div>
              )}

              {/* Redaksional Email Preview */}
              {showEmailPreview && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span>Subjek: {emailDraftPayload.subject}</span>
                    <span className="text-emerald-600 font-mono">Format GAS Standar</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed border border-slate-200 dark:border-slate-800">
                    {emailDraftPayload.plainTextBody}
                  </div>
                </div>
              )}

              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Masukkan alamat email pimpinan/tujuan (contoh: manager.hr@ajinomoto.co.id)..."
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
                    <span>Download Laporan PDF (GAS)</span>
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
