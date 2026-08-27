import { Employee, AppFiltersState, UserSession } from '../types';
import { BULAN_LABELS } from '../data/initialData';
import { computeDashboardStats } from './storage';

export interface EmailCustomContent {
  toEmail: string;
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
  methodUsed: 'webhook' | 'mailto' | 'clipboard';
}

const EMAIL_WEBHOOK_URL_KEY = 'msm_email_report_webhook_url_v1';

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
    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;">
      <tr>
        <td style="padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;color:#475569;">Total Karyawan</td>
        <td style="padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;text-align:right;font-weight:700;color:#0F172A;">${totalKaryawan}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #E2E8F0;color:#475569;">Standar (MS)</td>
        <td style="padding:10px 12px;border:1px solid #E2E8F0;text-align:right;font-weight:700;color:#0FA968;">${totalMS}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;color:#475569;">Belum Standar (US)</td>
        <td style="padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;text-align:right;font-weight:700;color:#E10600;">${totalUS}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #E2E8F0;color:#475569;">Pencapaian</td>
        <td style="padding:10px 12px;border:1px solid #E2E8F0;text-align:right;font-weight:700;color:#0F172A;">${percentMS}</td>
      </tr>
    </table>
  ` : '';

  const filterBadgeHtml = content.showFilterLine ? `
    <div style="text-align:center;padding:8px 12px;border-radius:10px;border:1px dashed #B8874B;background:#FBF3E7;margin-bottom:16px;font-size:11px;color:#5B6472;">
      ${filterLine}
    </div>
  ` : '';

  const additionalNotesHtml = content.additionalNotes?.trim() ? `
    <div style="background:#F1F5F9;border-left:4px solid #0E2340;padding:10px 14px;margin:14px 0;font-size:12.5px;color:#334155;">
      <strong>Catatan Tambahan:</strong><br>${content.additionalNotes.replace(/\n/g, '<br>')}
    </div>
  ` : '';

  const formattedSignHtml = content.senderSign
    .split('\n')
    .map((line, idx) => idx === 1 ? `<b style="color:#0E2340;">${line}</b>` : line)
    .join('<br>');

  // HTML Body (Format Resmi Standar Factory)
  const htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0F172A;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0E2340,#16345E);padding:22px 26px;border-radius:12px 12px 0 0;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:48px;vertical-align:middle;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/0/01/Ajinomoto_Group_Global_Brand_logo.png" width="44" style="display:block;border-radius:6px;background:#ffffff;padding:4px;" alt="Logo Ajinomoto">
        </td>
        <td style="vertical-align:middle;padding-left:14px;">
          <div style="color:#ffffff;font-size:11px;letter-spacing:1px;opacity:.85;text-transform:uppercase;font-weight:600;">PT AJINOMOTO INDONESIA — MOJOKERTO FACTORY</div>
          <div style="color:#ffffff;font-size:17px;font-weight:800;margin-top:3px;">Laporan Multi-Skill Monitoring</div>
        </td>
      </tr>
    </table>
  </div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 12px 12px;background:#ffffff;">
    <p style="margin-top:0;font-size:14px;color:#334155;">${content.salutation}</p>
    <p style="font-size:14px;color:#334155;line-height:1.6;">${content.mainParagraph.replace(/\n/g, '<br>')}</p>
    
    ${statTableHtml}
    ${filterBadgeHtml}
    ${additionalNotesHtml}

    <p style="font-size:12.5px;color:#64748B;line-height:1.7;margin-top:16px;">
      Laporan ini dihasilkan secara otomatis oleh sistem pada ${waktuKirim}, sebagai bagian dari proses monitoring kompetensi multi-skill karyawan di lingkungan Ajinomoto Mojokerto Factory.
    </p>
    <p style="font-size:13px;color:#475569;margin-top:12px;">
      ${content.closingParagraph.replace(/\n/g, '<br>')}
    </p>
    <p style="margin-top:20px;font-size:13px;color:#334155;line-height:1.6;">
      ${formattedSignHtml}
    </p>
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;">
      Email ini dikirimkan secara otomatis oleh sistem, mohon tidak membalas ke alamat ini.
    </div>
  </div>
</div>
  `.trim();

  // Plain text fallback (for Mail Client / WhatsApp / Native Client)
  const plainTextBody = `
${content.salutation}

${content.mainParagraph}

${content.showStatsTable ? `[RINGKASAN LAPORAN MULTI-SKILL]
• Total Karyawan      : ${totalKaryawan}
• Standar (MS)        : ${totalMS}
• Belum Standar (US)  : ${totalUS}
• Pencapaian          : ${percentMS}` : ''}
${content.showFilterLine ? `• Parameter Filter    : ${filterLine}` : ''}
${content.additionalNotes?.trim() ? `\n[CATATAN TAMBAHAN]\n${content.additionalNotes}` : ''}

Laporan ini dihasilkan secara otomatis oleh sistem pada ${waktuKirim}, sebagai bagian dari proses monitoring kompetensi multi-skill karyawan di lingkungan Ajinomoto Mojokerto Factory.

${content.closingParagraph}

${content.senderSign}

---
Email ini dikirimkan secara otomatis oleh sistem, mohon tidak membalas ke alamat ini.
  `.trim();

  return {
    toEmail: content.toEmail,
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
 * 1. Menghubungi Webhook endpoint jika dikonfigurasi.
 * 2. Membuka Email Client (Gmail / Outlook / Native Mailto) jika Webhook belum diset.
 */
export async function sendMultiSkillEmailReport(payload: EmailDispatchPayload): Promise<EmailDispatchResult> {
  const webhookUrl = getSavedEmailWebhookUrl();

  // Mode 1: Jika webhook terkonfigurasi
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
          methodUsed: 'webhook',
          message: `Laporan resmi berhasil dikirimkan ke ${payload.toEmail} melalui Automated Email Server.`
        };
      }
    } catch (err: any) {
      console.warn('Gagal mengirim via webhook, fallback ke Email Client:', err);
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
      message: `Draf email resmi telah disiapkan di aplikasi Email / Gmail Anda untuk penerima: ${payload.toEmail}.`
    };
  } catch (err: any) {
    return {
      success: false,
      methodUsed: 'clipboard',
      message: `Gagal membuka email client: ${err?.message || 'Unknown error'}`
    };
  }
}
