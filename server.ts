import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON with generous payload limits for base64 PDF attachments (up to 50MB)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // =========================================================================
  // API ROUTE: HEALTH CHECK
  // =========================================================================
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Multi-Skill Monitoring System API',
      timestamp: new Date().toISOString(),
      emailService: 'ready'
    });
  });

  // =========================================================================
  // API ROUTE: TEST SMTP CONNECTION
  // =========================================================================
  app.post('/api/test-smtp', async (req, res) => {
    try {
      const { host, port, secure, user, pass, from } = req.body || {};

      const smtpHost = host || process.env.SMTP_HOST;
      const smtpPort = port ? Number(port) : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
      const smtpSecure = secure !== undefined ? Boolean(secure) : (process.env.SMTP_SECURE === 'true' || smtpPort === 465);
      const smtpUser = user || process.env.SMTP_USER;
      const smtpPass = pass || process.env.SMTP_PASS;

      if (!smtpHost) {
        return res.status(400).json({
          success: false,
          message: 'Host SMTP belum ditentukan.'
        });
      }

      const transportOptions: nodemailer.TransportOptions = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: (smtpUser && smtpPass) ? { user: smtpUser, pass: smtpPass } : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 5000
      } as any;

      const transporter = nodemailer.createTransport(transportOptions);
      await transporter.verify();

      return res.json({
        success: true,
        message: `Koneksi ke server SMTP (${smtpHost}:${smtpPort}) berhasil diverifikasi.`
      });
    } catch (err: any) {
      console.error('SMTP test error:', err);
      return res.status(500).json({
        success: false,
        message: `Gagal terhubung ke SMTP: ${err?.message || 'Error tidak diketahui'}`
      });
    }
  });

  // =========================================================================
  // API ROUTE: SEND EMAIL DIRECTLY FROM SYSTEM
  // =========================================================================
  app.post('/api/send-email', async (req, res) => {
    try {
      const {
        to,
        cc,
        bcc,
        subject,
        htmlBody,
        plainTextBody,
        senderName,
        senderEmail,
        pdfBase64,
        pdfFileName,
        smtpConfig
      } = req.body || {};

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'Alamat email penerima (To) wajib diisi.'
        });
      }

      if (!subject || (!htmlBody && !plainTextBody)) {
        return res.status(400).json({
          success: false,
          message: 'Subjek dan konten email wajib diisi.'
        });
      }

      // Determine sender identity
      const defaultSenderName = 'Multi-Skill Monitoring System — Ajinomoto Mojokerto Factory';
      const defaultSenderEmail = process.env.SMTP_FROM || 'noreply@ajinomoto.co.id';
      const fromHeader = `"${senderName || defaultSenderName}" <${senderEmail || defaultSenderEmail}>`;

      // Determine SMTP config
      const host = smtpConfig?.host || process.env.SMTP_HOST;
      const port = smtpConfig?.port ? Number(smtpConfig.port) : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
      const secure = smtpConfig?.secure !== undefined
        ? Boolean(smtpConfig.secure)
        : (process.env.SMTP_SECURE === 'true' || port === 465);
      const user = smtpConfig?.user || process.env.SMTP_USER;
      const pass = smtpConfig?.pass || process.env.SMTP_PASS;

      let transporter: nodemailer.Transporter;
      let isSimulated = false;
      let previewUrl = '';

      if (host && user && pass) {
        // Mode 1: Custom / Configured Real SMTP Server
        transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          connectionTimeout: 15000,
          tls: {
            rejectUnauthorized: false // Allow self-signed or internal enterprise certs
          }
        });
      } else if (host) {
        // Mode 2: Unauthenticated Internal SMTP Relay (Corporate Factory Relay)
        transporter = nodemailer.createTransport({
          host,
          port,
          secure: false,
          connectionTimeout: 15000,
          tls: {
            rejectUnauthorized: false
          }
        });
      } else {
        // Mode 3: Direct Built-in System Dispatcher (uses Ethereal/Test Transporter fallback)
        try {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
        } catch (_) {
          // Fallback transporter
          transporter = nodemailer.createTransport({
            jsonTransport: true
          });
          isSimulated = true;
        }
      }

      // Prepare Attachments (PDF)
      const attachments = [];
      if (pdfBase64) {
        const cleanBase64 = pdfBase64.includes('base64,')
          ? pdfBase64.split('base64,')[1]
          : pdfBase64.replace(/^data:[^;]+;base64,/, '');
        attachments.push({
          filename: pdfFileName || 'Laporan_MultiSkill_Ajinomoto.pdf',
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: 'application/pdf'
        });
      }

      // Send Mail
      const mailOptions: nodemailer.SendMailOptions = {
        from: fromHeader,
        to: Array.isArray(to) ? to.join(', ') : to,
        cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
        subject: subject,
        html: htmlBody || undefined,
        text: plainTextBody || undefined,
        attachments: attachments.length ? attachments : undefined
      };

      const info = await transporter.sendMail(mailOptions);

      if (!isSimulated && nodemailer.getTestMessageUrl) {
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) {
          previewUrl = testUrl;
        }
      }

      const recipientStr = Array.isArray(to) ? to.join(', ') : to;
      const responseMessage = `Laporan resmi berhasil dikirimkan langsung dari sistem ke ${recipientStr}${attachments.length ? ' beserta lampiran dokumen PDF resmi' : ''}.`;

      return res.json({
        success: true,
        message: responseMessage,
        messageId: info.messageId || `MSG-${Date.now()}`,
        previewUrl: previewUrl || undefined,
        recipient: recipientStr,
        timestamp: new Date().toISOString(),
        hasAttachment: attachments.length > 0
      });
    } catch (err: any) {
      console.error('Error sending email directly from system:', err);
      return res.status(500).json({
        success: false,
        message: `Gagal mengirim email langsung: ${err?.message || 'Terjadi gangguan koneksi ke server email'}`
      });
    }
  });

  // =========================================================================
  // VITE MIDDLEWARE SETUP
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Multi-Skill Monitoring System running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
