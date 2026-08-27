import { Employee, AppFiltersState, UserSession } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from './storage';

export interface EmailCustomContent {
  toEmail: string;
  ccEmail?: string;
  bccEmail?: string;
  subject: string;
  salutation: string;
  mainParagraph: string;
  closingParagraph: string;
  senderSign: string;
  showStatsTable: boolean;
  showFilterLine: boolean;
  additionalNotes?: string;
}

export interface EmailDispatchPayload {
  toEmail: string;
  ccEmail?: string;
  bccEmail?: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  customContent: EmailCustomContent;
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
  methodUsed: 'direct_system' | 'smtp' | 'webhook' | 'mailto' | 'clipboard';
  messageId?: string;
  previewUrl?: string;
  timestamp?: string;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface EmailHistoryItem {
  id: string;
  timestamp: string;
  to: string;
  subject: string;
  periode: string;
  status: 'SUCCESS' | 'FAILED';
  method: string;
  messageId?: string;
  previewUrl?: string;
  hasPdfAttachment: boolean;
  notes?: string;
}

const EMAIL_WEBHOOK_URL_KEY = 'msm_email_report_webhook_url_v1';
const SMTP_CONFIG_KEY = 'msm_smtp_config_v1';
const EMAIL_HISTORY_KEY = 'msm_email_dispatch_history_v1';

// Default SMTP Configuration
export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'Multi-Skill Monitoring — Ajinomoto Mojokerto Factory',
  fromEmail: 'noreply@ajinomoto.co.id'
};

export function getSavedSmtpConfig(): SmtpConfig {
  try {
    const raw = localStorage.getItem(SMTP_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SMTP_CONFIG, ...parsed };
    }
  } catch (_) {}
  return DEFAULT_SMTP_CONFIG;
}

export function saveSmtpConfig(config: SmtpConfig): void {
  try {
    localStorage.setItem(SMTP_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving SMTP config:', err);
  }
}

export function getSavedEmailWebhookUrl(): string {
  try {
    const saved = localStorage.getItem(EMAIL_WEBHOOK_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (_) {}
  return '';
}

export function saveEmailWebhookUrl(url: string): void {
  try {
    localStorage.setItem(EMAIL_WEBHOOK_URL_KEY, url.trim());
  } catch (err) {
    console.error('Error saving email webhook URL:', err);
  }
}

export function getEmailHistory(): EmailHistoryItem[] {
  try {
    const raw = localStorage.getItem(EMAIL_HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) {}
  return [];
}

export function addEmailHistoryItem(item: Omit<EmailHistoryItem, 'id'>): void {
  try {
    const current = getEmailHistory();
    const newItem: EmailHistoryItem = {
      ...item,
      id: `EMAIL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    const updated = [newItem, ...current].slice(0, 50); // Keep last 50
    localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving email history item:', err);
  }
}

export function clearEmailHistory(): void {
  try {
    localStorage.removeItem(EMAIL_HISTORY_KEY);
  } catch (err) {
    console.error('Error clearing email history:', err);
  }
}

/**
 * Tes Koneksi ke Server SMTP via Backend API
 */
export async function testSmtpConnection(config: Partial<SmtpConfig>): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: config.pass,
        from: config.fromEmail
      })
    });

    const data = await res.json();
    return {
      success: !!data.success,
      message: data.message || (data.success ? 'Koneksi SMTP berhasil.' : 'Gagal terhubung ke SMTP.')
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi endpoint API: ${err?.message || 'Server backend tidak merespons'}`
    };
  }
}

/**
 * Menghasilkan nilai redaksional default sesuai standar resmi PT Ajinomoto Indonesia - Mojokerto Factory
 */
export function getDefaultEmailContent(options: {
  targetData: Employee[];
  filters: AppFiltersState;
  toEmail?: string;
}): EmailCustomContent {
  const { toEmail = 'pimpinan@ajinomoto.co.id' } = options;

  return {
    toEmail,
    subject: 'Laporan Multi-Skill Monitoring — Ajinomoto Mojokerto Factory',
    salutation: 'Yth. Bapak/Ibu Pimpinan HR Department,',
    mainParagraph:
      'Bersama email ini kami sampaikan Laporan Multi-Skill Monitoring periode terkini, mencakup rekapitulasi data per Divisi, Department, Grade, dan Job Position, serta telah dilengkapi tanda tangan elektronik dari HR Management sebagai bentuk validasi resmi. Dokumen lengkap terlampir dalam format PDF.',
    closingParagraph:
      'Apabila terdapat pertanyaan atau memerlukan informasi lebih lanjut terkait laporan ini, mohon berkenan menghubungi Tim HR Development Section.',
    senderSign:
      'Hormat kami,\nSistem Multi-Skill Monitoring\nHR Development Section\nPT Ajinomoto Indonesia — Mojokerto Factory',
    showStatsTable: true,
    showFilterLine: true,
    additionalNotes: ''
  };
}

/**
 * Menyusun Draf Email Lengkap (HTML & Plain Text) berbasis data & kustomisasi user
 */
export function buildMultiSkillEmailDraft(options: {
  targetData: Employee[];
  filters: AppFiltersState;
  currentUser: UserSession;
  customContent?: Partial<EmailCustomContent>;
}): EmailDispatchPayload {
  const { targetData, filters, currentUser } = options;

  const defaultContent = getDefaultEmailContent({ targetData, filters });
  const content: EmailCustomContent = {
    ...defaultContent,
    ...(options.customContent || {})
  };

  const stats = computeDashboardStats(targetData);
  const totalKaryawan = stats.totalManpower;
  const totalMS = stats.totalMS;
  const totalUS = stats.totalUS;
  const percentMSNum = (stats.percentMS * 100).toFixed(1);
  const percentMS = `${percentMSNum}%`;

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
  const waktuKirim = `${dateStr}, ${timeStr}`;

  const senderEmail = currentUser.email || 'mahmudnurdiansyah4@gmail.com';
  const fileName = `Laporan_MultiSkill_Ajinomoto_${periodeStr.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;

  const filterLine = `Periode: ${periodeStr} | Divisi: ${divisiFilter} | Dept: ${deptFilter}`;

  // Stat Table HTML
  const statTableHtml = content.showStatsTable ? `
    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
      <tr style="background:#0E2340;color:#ffffff;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;">Metrik Monitoring</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:700;">Hasil</th>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#475569;">Total Karyawan</td>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:right;font-weight:700;color:#0F172A;">${totalKaryawan} Orang</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;color:#475569;">Standar (MS)</td>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;text-align:right;font-weight:700;color:#0FA968;">${totalMS} Orang</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#475569;">Belum Standar (US)</td>
        <td style="padding:10px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:right;font-weight:700;color:#E10600;">${totalUS} Orang</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;color:#475569;font-weight:600;">Tingkat Pencapaian Standar</td>
        <td style="padding:10px 14px;border-top:1px solid #E2E8F0;text-align:right;font-weight:800;color:#B8874B;font-size:14px;">${percentMS}</td>
      </tr>
    </table>
  ` : '';

  const filterBadgeHtml = content.showFilterLine ? `
    <div style="text-align:center;padding:10px 14px;border-radius:8px;border:1px dashed #B8874B;background:#FBF3E7;margin-bottom:18px;font-size:12px;color:#5B6472;">
      <strong style="color:#B8874B;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;display:block;margin-bottom:3px;">Filter & Parameter Monitoring</strong>
      ${filterLine}
    </div>
  ` : '';

  const additionalNotesHtml = content.additionalNotes?.trim() ? `
    <div style="background:#F1F5F9;border-left:4px solid #0E2340;padding:12px 16px;margin:16px 0;font-size:13px;color:#334155;border-radius:0 6px 6px 0;">
      <strong style="color:#0E2340;">Catatan Tambahan:</strong><br>${content.additionalNotes.replace(/\n/g, '<br>')}
    </div>
  ` : '';

  const formattedSignHtml = content.senderSign
    .split('\n')
    .map((line, idx) => idx === 1 ? `<b style="color:#0E2340;">${line}</b>` : line)
    .join('<br>');

  // HTML Body (Format Resmi Standar Factory)
  const htmlBody = `
<div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0F172A;max-width:620px;margin:0 auto;background:#F8FAFC;padding:16px 8px;">
  <div style="background:linear-gradient(135deg,#0E2340 0%,#16345E 100%);padding:24px 28px;border-radius:12px 12px 0 0;border-bottom:4px solid #B8874B;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:50px;vertical-align:middle;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png" width="46" style="display:block;border-radius:6px;background:#ffffff;padding:4px;" alt="Logo Ajinomoto">
        </td>
        <td style="vertical-align:middle;padding-left:16px;">
          <div style="color:#B8874B;font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">PT AJINOMOTO INDONESIA</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;margin-top:2px;">MOJOKERTO FACTORY</div>
          <div style="color:#CBD5E1;font-size:12px;margin-top:2px;">Laporan Monitoring Multi-Skill Karyawan & Manajer</div>
        </td>
      </tr>
    </table>
  </div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:26px;border-radius:0 0 12px 12px;background:#ffffff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <p style="margin-top:0;font-size:14.5px;color:#334155;font-weight:600;">${content.salutation}</p>
    <p style="font-size:14px;color:#334155;line-height:1.65;">${content.mainParagraph.replace(/\n/g, '<br>')}</p>
    
    ${filterBadgeHtml}
    ${statTableHtml}
    ${additionalNotesHtml}

    <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:12px 16px;margin:18px 0;display:flex;align-items:center;">
      <div style="font-size:12.5px;color:#065F46;line-height:1.5;">
        <strong>✓ Dokumen PDF Resmi Terlampir:</strong> Laporan 3 halaman lengkap (Rekap Divisi, Department, Grade, Job Position, dan E-Signature HR Management) telah dilampirkan langsung pada pesan ini.
      </div>
    </div>

    <p style="font-size:12.5px;color:#64748B;line-height:1.7;margin-top:16px;">
      Laporan ini digenerate secara otomatis oleh sistem pada ${waktuKirim}, sebagai bagian dari monitoring berkala kompetensi multi-skill di lingkungan Ajinomoto Mojokerto Factory.
    </p>
    <p style="font-size:13.5px;color:#475569;margin-top:14px;">
      ${content.closingParagraph.replace(/\n/g, '<br>')}
    </p>
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #F1F5F9;font-size:13px;color:#334155;line-height:1.6;">
      ${formattedSignHtml}
    </div>
    <div style="margin-top:22px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center;">
      Email ini dikirimkan secara langsung dari Sistem Multi-Skill Monitoring Ajinomoto Mojokerto Factory.
    </div>
  </div>
</div>
  `.trim();

  // Plain text version
  const plainTextBody = `
${content.salutation}

${content.mainParagraph}

${content.showStatsTable ? `[RINGKASAN LAPORAN MULTI-SKILL]
• Total Karyawan      : ${totalKaryawan} Orang
• Standar (MS)        : ${totalMS} Orang
• Belum Standar (US)  : ${totalUS} Orang
• Pencapaian Standar  : ${percentMS}` : ''}
${content.showFilterLine ? `• Parameter Filter    : ${filterLine}` : ''}
${content.additionalNotes?.trim() ? `\n[CATATAN TAMBAHAN]\n${content.additionalNotes}` : ''}

Dokumen PDF Resmi Terlampir: Laporan 3 halaman lengkap (Rekap Divisi, Department, Grade, Job Position, dan E-Signature HR Management).

Laporan ini dihasilkan secara otomatis oleh sistem pada ${waktuKirim}, sebagai bagian dari monitoring berkala kompetensi multi-skill di lingkungan Ajinomoto Mojokerto Factory.

${content.closingParagraph}

${content.senderSign}

---
Email ini dikirimkan secara langsung dari Sistem Multi-Skill Monitoring Ajinomoto Mojokerto Factory.
  `.trim();

  return {
    toEmail: content.toEmail,
    ccEmail: content.ccEmail,
    bccEmail: content.bccEmail,
    senderName: 'Multi-Skill Monitoring System — Ajinomoto Mojokerto Factory',
    senderEmail,
    subject: content.subject,
    htmlBody,
    plainTextBody,
    customContent: content,
    reportMetadata: {
      periode: periodeStr,
      totalKaryawan,
      totalMS,
      totalUS,
      percentMS,
      divisiFilter,
      deptFilter,
      generatedAt: waktuKirim,
      fileName
    }
  };
}

/**
 * Dispatch Report Email:
 * 1. Mengirim langsung melalui Backend API (/api/send-email) dengan lampiran file PDF (Base64).
 * 2. Menggunakan konfigurasi SMTP custom bila ada, atau built-in direct server dispatcher.
 * 3. Fallback ke Webhook atau Mail Client jika server backend tidak dapat diakses.
 */
export async function sendMultiSkillEmailReport(
  payload: EmailDispatchPayload,
  pdfBase64?: string,
  pdfFileName?: string
): Promise<EmailDispatchResult> {
  const smtpConfig = getSavedSmtpConfig();

  // =========================================================================
  // METODE UTAMA: KIRIM LANGSUNG DARI SYSTEM VIA BACKEND /api/send-email
  // =========================================================================
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: payload.toEmail,
        cc: payload.ccEmail,
        bcc: payload.bccEmail,
        subject: payload.subject,
        htmlBody: payload.htmlBody,
        plainTextBody: payload.plainTextBody,
        senderName: smtpConfig.enabled && smtpConfig.fromName ? smtpConfig.fromName : payload.senderName,
        senderEmail: smtpConfig.enabled && smtpConfig.fromEmail ? smtpConfig.fromEmail : payload.senderEmail,
        pdfBase64: pdfBase64 || undefined,
        pdfFileName: pdfFileName || payload.reportMetadata.fileName,
        smtpConfig: smtpConfig.enabled ? {
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          user: smtpConfig.user,
          pass: smtpConfig.pass,
          from: smtpConfig.fromEmail
        } : undefined
      })
    });

    if (res.ok) {
      const data = await res.json();
      
      // Catat ke riwayat pengiriman sistem
      addEmailHistoryItem({
        timestamp: new Date().toISOString(),
        to: payload.toEmail,
        subject: payload.subject,
        periode: payload.reportMetadata.periode,
        status: 'SUCCESS',
        method: smtpConfig.enabled ? `SMTP (${smtpConfig.host})` : 'Direct System Server',
        messageId: data.messageId,
        previewUrl: data.previewUrl,
        hasPdfAttachment: Boolean(pdfBase64),
        notes: `Terkirim ke ${payload.toEmail}`
      });

      return {
        success: true,
        methodUsed: smtpConfig.enabled ? 'smtp' : 'direct_system',
        message: data.message || `Laporan resmi berhasil dikirimkan langsung dari sistem ke ${payload.toEmail}${pdfBase64 ? ' beserta lampiran PDF' : ''}.`,
        messageId: data.messageId,
        previewUrl: data.previewUrl,
        timestamp: data.timestamp || new Date().toISOString()
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn('Backend send-email error status:', res.status, errData);
      throw new Error(errData.message || `Server merespons dengan status ${res.status}`);
    }
  } catch (backendError: any) {
    console.warn('Pengiriman langsung backend mengalami kendala, memeriksa opsi cadangan:', backendError);

    // =========================================================================
    // METODE CADANGAN 1: WEBHOOK (JIKA DIKONFIGURASI)
    // =========================================================================
    const webhookUrl = getSavedEmailWebhookUrl();
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
            cc: payload.ccEmail,
            bcc: payload.bccEmail,
            subject: payload.subject,
            htmlBody: payload.htmlBody,
            plainBody: payload.plainTextBody,
            metadata: payload.reportMetadata,
            pdfBase64: pdfBase64 || null,
            pdfFileName: pdfFileName || payload.reportMetadata.fileName,
            senderName: payload.senderName,
            senderEmail: payload.senderEmail
          })
        });

        if (response.ok) {
          addEmailHistoryItem({
            timestamp: new Date().toISOString(),
            to: payload.toEmail,
            subject: payload.subject,
            periode: payload.reportMetadata.periode,
            status: 'SUCCESS',
            method: 'Webhook API',
            hasPdfAttachment: Boolean(pdfBase64),
            notes: `Terkirim via webhook`
          });

          return {
            success: true,
            methodUsed: 'webhook',
            message: `Laporan resmi berhasil dikirimkan ke ${payload.toEmail} melalui Automated Webhook Server.`
          };
        }
      } catch (webhookErr) {
        console.warn('Webhook error:', webhookErr);
      }
    }

    // =========================================================================
    // METODE CADANGAN 2: FALLBACK KE NATIVE MAILTO BROWSER
    // =========================================================================
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

      addEmailHistoryItem({
        timestamp: new Date().toISOString(),
        to: payload.toEmail,
        subject: payload.subject,
        periode: payload.reportMetadata.periode,
        status: 'SUCCESS',
        method: 'Mail Client (Mailto Fallback)',
        hasPdfAttachment: false,
        notes: `Dibuka via Email Client`
      });

      return {
        success: true,
        methodUsed: 'mailto',
        message: `Draf email resmi telah disiapkan di aplikasi Email untuk penerima: ${payload.toEmail}.`
      };
    } catch (err: any) {
      addEmailHistoryItem({
        timestamp: new Date().toISOString(),
        to: payload.toEmail,
        subject: payload.subject,
        periode: payload.reportMetadata.periode,
        status: 'FAILED',
        method: 'Direct System',
        hasPdfAttachment: false,
        notes: `Gagal: ${backendError?.message || err?.message}`
      });

      return {
        success: false,
        methodUsed: 'clipboard',
        message: `Gagal mengirim email: ${backendError?.message || err?.message || 'Unknown error'}`
      };
    }
  }
}
