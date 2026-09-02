import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket
} from '@whiskeysockets/baileys';
import { LocalWhatsAppInfo, LocalWhatsAppStatus } from '../types';

const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR
  ? path.resolve(process.env.WHATSAPP_AUTH_DIR)
  : path.resolve(process.cwd(), '.whatsapp_auth');

let sock: WASocket | null = null;
let currentStatus: LocalWhatsAppStatus = 'DISCONNECTED';
let currentQrCode: string | undefined = undefined;
let connectedPhone: string | undefined = undefined;
let connectedName: string | undefined = undefined;
let lastError: string | undefined = undefined;
let isInitializing: boolean = false;

const logger = pino({ level: 'silent' });

export function getLocalWhatsAppStatus(): LocalWhatsAppInfo {
  return {
    status: currentStatus,
    qrCode: currentQrCode,
    phoneNumber: connectedPhone,
    name: connectedName,
    error: lastError,
    lastUpdated: new Date().toISOString()
  };
}

export async function initLocalWhatsAppGateway(forceNew: boolean = false): Promise<LocalWhatsAppInfo> {
  if (isInitializing) {
    return getLocalWhatsAppStatus();
  }

  // If already connected and not forcing new session, return current
  if (sock && currentStatus === 'CONNECTED' && !forceNew) {
    return getLocalWhatsAppStatus();
  }

  if (forceNew) {
    await disconnectLocalWhatsAppGateway();
  }

  isInitializing = true;
  currentStatus = 'CONNECTING';
  lastError = undefined;

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['Smart Bill POS', 'Desktop', '1.0.0'],
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentStatus = 'SCAN_QR';
        try {
          currentQrCode = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: {
              dark: '#128C7E',
              light: '#FFFFFF'
            }
          });
        } catch (qrErr) {
          console.error('Failed to generate QR data URL:', qrErr);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[Local WhatsApp] Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);

        currentStatus = 'DISCONNECTED';
        currentQrCode = undefined;
        connectedPhone = undefined;
        connectedName = undefined;

        if (statusCode === DisconnectReason.loggedOut) {
          lastError = 'Logged out from WhatsApp on your phone.';
          cleanupAuthDir();
        } else if (shouldReconnect) {
          // Attempt automatic reconnection after brief delay
          setTimeout(() => {
            initLocalWhatsAppGateway(false).catch(console.error);
          }, 3000);
        }
      } else if (connection === 'open') {
        console.log('[Local WhatsApp] Connected successfully!');
        currentStatus = 'CONNECTED';
        currentQrCode = undefined;
        lastError = undefined;

        const user = sock?.user;
        if (user) {
          const rawId = user.id ? user.id.split(':')[0] : '';
          connectedPhone = rawId ? `+${rawId}` : undefined;
          connectedName = user.name || 'My WhatsApp';
        }
      }
    });

    isInitializing = false;
    return getLocalWhatsAppStatus();
  } catch (err: any) {
    console.error('[Local WhatsApp] Initialization error:', err);
    isInitializing = false;
    currentStatus = 'DISCONNECTED';
    lastError = err.message || 'Failed to start local WhatsApp gateway';
    return getLocalWhatsAppStatus();
  }
}

export async function disconnectLocalWhatsAppGateway(): Promise<{ success: boolean; message: string }> {
  try {
    if (sock) {
      try {
        await sock.logout();
      } catch (_ignore) {}
      try {
        sock.end(undefined);
      } catch (_ignore) {}
      sock = null;
    }

    cleanupAuthDir();

    currentStatus = 'DISCONNECTED';
    currentQrCode = undefined;
    connectedPhone = undefined;
    connectedName = undefined;
    lastError = undefined;

    return { success: true, message: 'WhatsApp session disconnected successfully' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to disconnect session' };
  }
}

function cleanupAuthDir() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Error cleaning auth dir:', e);
  }
}

export function formatWhatsAppJid(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return `${cleaned}@s.whatsapp.net`;
}

export async function sendLocalWhatsAppPdf(
  recipientPhone: string,
  pdfBuffer: Buffer | Uint8Array,
  filename: string,
  caption: string
): Promise<{ success: boolean; message: string; messageId?: string }> {
  if (!sock || currentStatus !== 'CONNECTED') {
    return {
      success: false,
      message: 'Local WhatsApp is not connected. Please check Settings to scan the QR code.'
    };
  }

  try {
    const firstPhone = (recipientPhone || '').split(',')[0].trim();
    let cleanPhone = firstPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const defaultJid = `${cleanPhone}@s.whatsapp.net`;

    // 1. Resolve exact WhatsApp JID
    let targetJid = defaultJid;
    try {
      if (sock.onWhatsApp) {
        const onWaPromise = sock.onWhatsApp(cleanPhone);
        const timeoutPromise = new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error('onWhatsApp check timed out')), 4000)
        );
        const [result] = await Promise.race([onWaPromise, timeoutPromise]);
        if (result && result.exists && result.jid) {
          targetJid = result.jid;
        }
      }
    } catch (_ignore) {
      targetJid = defaultJid;
    }

    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    console.log(`[Local WhatsApp] Dispatching document to ${targetJid}...`);

    // 2. Send Document Message with a 15-second timeout
    const sendDocPromise = sock.sendMessage(targetJid, {
      document: buffer,
      mimetype: 'application/pdf',
      fileName: filename || 'Invoice.pdf',
      caption: caption || 'Invoice attached'
    });

    const docTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Document upload took longer than 15 seconds')), 15000)
    );

    const sent = await Promise.race([sendDocPromise, docTimeoutPromise]);
    const msgId = sent?.key?.id || '';

    console.log(`[Local WhatsApp] Document sent successfully! ID: ${msgId}`);

    return {
      success: true,
      message: 'Invoice PDF sent successfully via linked WhatsApp!',
      messageId: msgId
    };
  } catch (err: any) {
    console.error('[Local WhatsApp] Error sending document:', err);

    // 3. Fallback: If media upload timed out or failed, send instant text receipt so customer gets the bill!
    try {
      let cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
      const targetJid = `${cleanPhone}@s.whatsapp.net`;

      console.log(`[Local WhatsApp] Attempting text bill fallback to ${targetJid}...`);

      const sendTextPromise = sock.sendMessage(targetJid, { text: caption });
      const textTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Text send timed out')), 6000)
      );

      const sentText = await Promise.race([sendTextPromise, textTimeout]);
      return {
        success: true,
        message: 'Bill summary sent via WhatsApp! (PDF media upload timed out)',
        messageId: sentText?.key?.id || ''
      };
    } catch (_fallbackErr) {
      return {
        success: false,
        message: err.message || 'Failed to send WhatsApp document through linked device'
      };
    }
  }
}
