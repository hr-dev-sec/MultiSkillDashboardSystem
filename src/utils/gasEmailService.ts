import { Employee, AppFiltersState, UserSession } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from './storage';

export interface EmailDispatchPayload {
  toEmail: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  reportMetadata: {
    periode: string;
    totalKaryawan: number;
    totalMS: number;
    totalUS: number;
    percentMS: string;
    divisiFilter: string;
    deptFilter: string;
    generatedAt: string;
    fileName: string;
  };
}

export interface EmailDispatchResult {
  success: boolean;
  message: string;
  methodUsed: 'gas_webhook' | 'mailto' | 'simulated';
}

const GAS_WEBHOOK_URL_KEY = 'msm_gas_email_webhook_url_v1';

export function getSavedGasWebhookUrl(): string {
  try {
    const saved = localStorage.getItem(GAS_WEBHOOK_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (_) {}
  return '';
}

export function saveGasWebhookUrl(url: string): void {
  try {
    localStorage.setItem(GAS_WEBHOOK_URL_KEY, url.trim());
  } catch (err) {
    console.error('Error saving GAS webhook URL:', err);
  }
}

/**
 * Format Redaksional Email Resmi Standar Google Apps Script (GAS) Ajinomoto
 */
export function buildGasEmailDraft(options: {
  toEmail: string;
  targetData: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  signerName?: string;
  signerRole?: string;
}): EmailDispatchPayload {
  const { toEmail, targetData, filters, currentUser, signerName = currentUser.name, signerRole = currentUser.role || 'HR Development Specialist' } = options;

  const stats = computeDashboardStats(targetData);
  const totalKaryawan = stats.totalManpower;
  const totalMS = stats.totalMS;
  const totalUS = stats.totalUS;
  const percentMS = (stats.percentMS * 100).toFixed(1) + '%';

  const thnStr = filters.tahun.join(', ') || String(new Date().getFullYear());
  const blnStr = filters.bulan.length
    ? filters.bulan.map((b) => BULAN_LABELS[Number(b) - 1] || b).join(', ')
    : BULAN_LABELS[new Date().getMonth()];

  const periodeStr = `${blnStr} ${thnStr}`;
  const divisiFilter = filters.divisi.length ? filters.divisi.join(', ') : 'Semua Divisi';
  const deptFilter = filters.department.length ? filters.department.join(', ') : 'Semua Departemen';
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const fullTimestamp = `${dateStr} pukul ${timeStr}`;

  const senderEmail = currentUser.email || 'mahmudnurdiansyah4@gmail.com';
  const subject = `[OFFICIAL REPORT] Rekapitulasi Multi-Skill Monitoring Periode ${periodeStr} - PT Ajinomoto Indonesia`;
  const fileName = `Laporan_MultiSkill_Ajinomoto_${periodeStr.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;

  // Top 4 Divisi Breakdown Table for Email Body
  const topDivisions = Object.entries(stats.byDivisi)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([divName, data]) => {
      const pct = (data.percent * 100).toFixed(1) + '%';
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">${divName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-weight: bold; color: #0f172a;">${data.total}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-weight: bold; color: #16a34a;">${data.ms}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-weight: bold; color: #dc2626;">${data.us}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-weight: bold; color: #1e40af;">${pct}</td>
        </tr>
      `;
    })
    .join('');

  // HTML Body (Format Eksekutif Resmi Google Apps Script Ajinomoto Factory)
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 680px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0E2340 0%, #1a365d 100%); color: #ffffff; padding: 24px 28px; }
    .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 0; font-size: 13px; color: #cbd5e1; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; background: rgba(220, 38, 38, 0.2); color: #fca5a5; border: 1px solid rgba(220, 38, 38, 0.4); margin-bottom: 10px; }
    .content { padding: 28px; }
    .kpi-grid { display: table; width: 100%; table-layout: fixed; margin: 20px 0; border-collapse: separate; border-spacing: 10px 0; }
    .kpi-card { display: table-cell; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
    .kpi-val { font-size: 22px; font-weight: 800; margin: 4px 0 0 0; }
    .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .table-container { margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #0E2340; color: #ffffff; padding: 10px 12px; font-size: 12px; text-transform: uppercase; font-weight: bold; }
    .footer { background: #f1f5f9; padding: 20px 28px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .sign-box { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">AJINOMOTO INDONESIA • OFFICIAL REPORT</div>
      <h1>Laporan Evaluasi & Monitoring Multi-Skill Karyawan</h1>
      <p>Periode Evaluasi: <strong>${periodeStr}</strong> &bull; Mojokerto Factory</p>
    </div>
    
    <div class="content">
      <p>Yth. Bapak/Ibu Pimpinan & Tim Manajemen,</p>
      
      <p style="font-size: 14px; color: #475569;">
        Berikut kami sampaikan rekapitulasi data hasil monitoring kompetensi dan kualifikasi <strong>Multi-Skill Karyawan & Manajer</strong> PT Ajinomoto Indonesia untuk periode <strong>${periodeStr}</strong> yang telah diolah melalui sistem:
      </p>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Manpower</div>
          <div class="kpi-val" style="color: #0E2340;">${totalKaryawan}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Multi-Skill (MS)</div>
          <div class="kpi-val" style="color: #16a34a;">${totalMS}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Under-Skill (US)</div>
          <div class="kpi-val" style="color: #dc2626;">${totalUS}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Pencapaian MS</div>
          <div class="kpi-val" style="color: #2563eb;">${percentMS}</div>
        </div>
      </div>

      <div style="background-color: #f8fafc; border-left: 4px solid #0E2340; padding: 12px 16px; margin: 18px 0; font-size: 13px;">
        <strong>Parameter Filter Aktif:</strong><br>
        &bull; Divisi: ${divisiFilter}<br>
        &bull; Departemen: ${deptFilter}<br>
        &bull; Total Data Evaluasi: ${totalKaryawan} Karyawan
      </div>

      <h3 style="font-size: 14px; color: #0E2340; margin: 20px 0 10px 0;">Ringkasan Kualifikasi per Divisi:</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Divisi</th>
              <th style="text-align: center;">Total</th>
              <th style="text-align: center;">MS</th>
              <th style="text-align: center;">US</th>
              <th style="text-align: center;">% MS</th>
            </tr>
          </thead>
          <tbody>
            ${topDivisions}
          </tbody>
        </table>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        Dokumen laporan lengkap berformat <strong>PDF Resmi GAS (3 Halaman + E-Sign Digital)</strong> dan lembar data spreadsheet Excel telah diterbitkan dan dapat diunduh langsung melalui dashboard sistem.
      </p>

      <div class="sign-box">
        <p style="margin: 0 0 4px 0; color: #64748b;">Diterbitkan secara resmi oleh:</p>
        <p style="margin: 0; font-weight: bold; color: #0E2340;">${signerName}</p>
        <p style="margin: 0; color: #64748b; font-size: 12px;">${signerRole} &bull; Human Resources Development Dept.</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">Verifikasi Digital Timestamp: ${fullTimestamp}</p>
      </div>
    </div>

    <div class="footer">
      Sistem Multi-Skill Monitoring &copy; PT Ajinomoto Indonesia - Mojokerto Factory.<br>
      Email ini dikirimkan secara otomatis melalui pipeline integrasi Google Apps Script (GAS) System.
    </div>
  </div>
</body>
</html>
  `.trim();

  // Plain text fallback (for Mailto or Plain Clients)
  const plainTextBody = `
Yth. Bapak/Ibu Pimpinan & Tim Manajemen,

Berikut kami sampaikan rekapitulasi data hasil evaluasi Multi-Skill Monitoring Karyawan & Manajer PT Ajinomoto Indonesia untuk periode ${periodeStr}:

[RINGKASAN KPI UTAMA]
- Periode Evaluasi : ${periodeStr}
- Total Manpower   : ${totalKaryawan} Karyawan
- Multi-Skill (MS) : ${totalMS} Karyawan
- Under-Skill (US) : ${totalUS} Karyawan
- Persentase MS    : ${percentMS}

[PARAMETER FILTER AKTIF]
- Divisi     : ${divisiFilter}
- Departemen : ${deptFilter}

Dokumen laporan resmi PDF bertanda tangan elektronik (E-Sign) serta file master spreadsheet telah tersinkronkan pada sistem.

Hormat kami,
${signerName}
${signerRole}
PT Ajinomoto Indonesia - Mojokerto Factory
Timestamp: ${fullTimestamp}
  `.trim();

  return {
    toEmail,
    senderName: signerName,
    senderEmail,
    subject,
    htmlBody,
    plainTextBody,
    reportMetadata: {
      periode: periodeStr,
      totalKaryawan,
      totalMS,
      totalUS,
      percentMS,
      divisiFilter,
      deptFilter,
      generatedAt: fullTimestamp,
      fileName
    }
  };
}

/**
 * Dispatch Report Email:
 * 1. Menghubungi Google Apps Script (GAS) Webhook jika URL Webhook sudah dikonfigurasi.
 * 2. Membuka Email Client (Gmail / Outlook / Default Mailto) jika Webhook belum diset.
 */
export async function sendMultiSkillEmailReport(payload: EmailDispatchPayload): Promise<EmailDispatchResult> {
  const webhookUrl = getSavedGasWebhookUrl();

  // Mode 1: Jika user memasang Google Apps Script Webhook endpoint
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sendReportEmail',
          to: payload.toEmail,
          subject: payload.subject,
          htmlBody: payload.htmlBody,
          plainBody: payload.plainTextBody,
          metadata: payload.reportMetadata,
          senderName: payload.senderName,
          senderEmail: payload.senderEmail
        })
      });

      if (response.ok) {
        return {
          success: true,
          methodUsed: 'gas_webhook',
          message: `Laporan resmi berhasil dikirimkan ke ${payload.toEmail} melalui Google Apps Script Webhook.`
        };
      }
    } catch (err: any) {
      console.warn('Gagal mengirim via GAS Webhook, fallback ke Email Client:', err);
    }
  }

  // Mode 2: Mailto / Browser Native Email Trigger
  try {
    const encodedSubject = encodeURIComponent(payload.subject);
    const encodedBody = encodeURIComponent(payload.plainTextBody);
    const mailtoUrl = `mailto:${encodeURIComponent(payload.toEmail)}?subject=${encodedSubject}&body=${encodedBody}`;

    const link = document.createElement('a');
    link.href = mailtoUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      methodUsed: 'mailto',
      message: `Draf email resmi sesuai format GAS telah disiapkan di aplikasi Email / Gmail Anda untuk ${payload.toEmail}.`
    };
  } catch (err: any) {
    return {
      success: false,
      methodUsed: 'simulated',
      message: `Gagal membuka email client: ${err?.message || 'Unknown error'}`
    };
  }
}
