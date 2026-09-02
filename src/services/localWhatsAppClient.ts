import { Invoice, LocalWhatsAppInfo, StoreSettings } from '../types';

async function parseSafeJson<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export async function fetchLocalWhatsAppStatus(): Promise<LocalWhatsAppInfo> {
  try {
    const res = await fetch('/api/whatsapp-local/status', {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });
    if (res.ok) {
      const data = await parseSafeJson<LocalWhatsAppInfo>(res);
      if (data) return data;
    }
  } catch {
    // Graceful offline fallback
  }
  return {
    status: 'DISCONNECTED',
    error: 'Backend server not running'
  };
}

export async function startLocalWhatsApp(forceNew: boolean = false): Promise<LocalWhatsAppInfo> {
  try {
    const res = await fetch('/api/whatsapp-local/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ forceNew })
    });
    if (res.ok) {
      const data = await parseSafeJson<LocalWhatsAppInfo>(res);
      if (data) return data;
    }
    const errData = (await parseSafeJson<any>(res)) || {};
    return {
      status: 'DISCONNECTED',
      error:
        errData.message ||
        (res.status === 404
          ? 'Local WhatsApp pairing is available when running locally on your PC (`npm run dev`). On cloud hosts like Netlify, use the WhatsApp button to share directly via WhatsApp Web/App.'
          : 'Failed to start WhatsApp pairing')
    };
  } catch (err: any) {
    return {
      status: 'DISCONNECTED',
      error: err.message || 'Error connecting to local WhatsApp service'
    };
  }
}

export async function logoutLocalWhatsApp(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/whatsapp-local/logout', {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      }
    });
    if (res.ok) {
      const data = await parseSafeJson<{ success: boolean; message: string }>(res);
      if (data) return data;
    }
    return {
      success: false,
      message: 'Failed to logout or server not reachable'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to logout from local WhatsApp'
    };
  }
}

export async function sendLocalWhatsAppInvoicePdf(
  invoice: Invoice,
  store: StoreSettings,
  recipientPhone: string
): Promise<{ success: boolean; message: string; messageId?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('/api/whatsapp-local/send-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        invoice,
        store,
        recipientPhone
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await parseSafeJson<{ success: boolean; message: string; messageId?: string }>(res);
      if (data) return data;
    }
    const errData = (await parseSafeJson<any>(res)) || {};
    return {
      success: false,
      message: errData.message || (res.status === 404 ? 'Backend server not available on this domain. Please use WhatsApp Web share.' : 'Failed to send invoice through linked WhatsApp')
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'WhatsApp sending took too long. You can send instantly via the WhatsApp Web link.'
      };
    }
    return {
      success: false,
      message: err.message || 'Failed to send invoice through linked WhatsApp'
    };
  }
}
