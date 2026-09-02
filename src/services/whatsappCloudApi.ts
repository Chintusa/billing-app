export interface WhatsAppSendResult {
  success: boolean;
  message: string;
  mediaId?: string;
  whatsappMessageId?: string;
  details?: any;
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const firstPhone = phone.split(',')[0].trim();
  let cleaned = firstPhone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

export async function uploadPdfToWhatsApp(
  pdfBuffer: Uint8Array | Buffer | Blob | ArrayBuffer,
  filename: string,
  accessToken: string,
  phoneNumberId: string,
  apiVersion: string = 'v21.0'
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const cleanPhoneId = (phoneNumberId || '').trim();
    const cleanToken = (accessToken || '').trim();
    const cleanVer = (apiVersion || 'v21.0').trim() || 'v21.0';

    if (!cleanToken || !cleanPhoneId) {
      return {
        success: false,
        error: 'WhatsApp Access Token and Phone Number ID are required.'
      };
    }

    const url = `https://graph.facebook.com/${cleanVer}/${cleanPhoneId}/media`;

    const blob = pdfBuffer instanceof Blob ? pdfBuffer : new Blob([pdfBuffer as any], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', 'application/pdf');
    formData.append('file', blob, filename || 'invoice.pdf');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanToken}`
      },
      body: formData
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return {
        success: false,
        error: `Unexpected response from WhatsApp media API (HTTP ${response.status}): ${text.substring(0, 150)}`
      };
    }

    const data = await response.json();

    if (!response.ok || !data.id) {
      console.error('WhatsApp Media Upload Error:', data);
      const errMsg =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        (data?.error?.type ? `${data.error.type}: ${data.error.message || 'Media upload failed'}` : 'Failed to upload PDF media to WhatsApp Cloud API');
      return {
        success: false,
        error: errMsg
      };
    }

    return {
      success: true,
      mediaId: data.id
    };
  } catch (err: any) {
    console.error('Exception during WhatsApp media upload:', err);
    return {
      success: false,
      error: err.message || 'Error uploading PDF media to WhatsApp'
    };
  }
}

export async function testWhatsAppConnection(
  accessToken: string,
  phoneNumberId: string,
  apiVersion: string = 'v21.0'
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const cleanPhoneId = (phoneNumberId || '').trim();
    const cleanToken = (accessToken || '').trim();
    const cleanVer = (apiVersion || 'v21.0').trim() || 'v21.0';

    if (!cleanToken || !cleanPhoneId) {
      return {
        success: false,
        message: 'WhatsApp Access Token and Phone Number ID are required.'
      };
    }

    const url = `https://graph.facebook.com/${cleanVer}/${cleanPhoneId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanToken}`
      }
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return {
        success: false,
        message: `Unexpected response from WhatsApp API (HTTP ${response.status}): ${text.substring(0, 150)}`
      };
    }

    const data = await response.json();
    if (!response.ok || data.error) {
      const errMsg =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        'Authentication failed with WhatsApp Cloud API. Please check your Access Token and Phone Number ID.';
      return {
        success: false,
        message: errMsg
      };
    }

    const displayPhone = data.display_phone_number ? ` (Phone: ${data.display_phone_number})` : ` (ID: ${cleanPhoneId})`;
    const quality = data.quality_rating ? ` [Quality: ${data.quality_rating}]` : '';

    return {
      success: true,
      message: `WhatsApp API Connected Successfully!${displayPhone}${quality}`,
      data
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to WhatsApp Cloud API'
    };
  }
}

export function parseMetaApiError(data: any, defaultFallback: string = 'WhatsApp API request failed'): string {
  if (!data?.error) return defaultFallback;

  const code = data.error.code;
  const subcode = data.error.error_subcode;
  const rawMsg = data.error.message || '';
  const userMsg = data.error.error_user_msg || '';

  // 1. 24-Hour Customer Care Window restriction (Error 131047 / Re-engagement)
  if (code === 131047 || rawMsg.toLowerCase().includes('24 hour') || rawMsg.toLowerCase().includes('re-engagement') || rawMsg.toLowerCase().includes('customer care window')) {
    return 'Meta 24-Hour Policy: Recipient has not messaged your WhatsApp number in the last 24 hours. To message new customers anytime, please enable and use a WhatsApp Message Template in Settings.';
  }

  // 2. Sandbox / Test Phone Number restriction (Error 131030)
  if (code === 131030 || rawMsg.toLowerCase().includes('not in allowed list') || rawMsg.toLowerCase().includes('sandbox')) {
    return 'Sandbox Restriction: Your Meta App is using a Test Number and can only send to verified numbers in your Meta Dashboard. To message any customer, connect a live phone number or switch to Production.';
  }

  // 3. Template not found or status not approved (Error 132000, 132001, 132015)
  if (code === 132000 || code === 132001 || code === 132015 || rawMsg.toLowerCase().includes('template')) {
    return `Template Error (${code}): ${rawMsg}. Please check that your template name and language code in Settings match the approved template in Meta WhatsApp Manager.`;
  }

  // 4. Authentication / Token issues (Error 190)
  if (code === 190 || data.error.type === 'OAuthException') {
    return 'WhatsApp Authentication Error: Access Token is invalid or expired. Please generate a new System User Permanent Token in Meta Business Suite.';
  }

  return userMsg || rawMsg || (data.error.type ? `${data.error.type}: ${rawMsg}` : defaultFallback);
}

export async function sendWhatsAppDocumentMessage(
  recipientPhone: string,
  mediaId: string,
  filename: string,
  caption: string,
  accessToken: string,
  phoneNumberId: string,
  apiVersion: string = 'v21.0'
): Promise<WhatsAppSendResult> {
  try {
    const cleanPhoneId = (phoneNumberId || '').trim();
    const cleanToken = (accessToken || '').trim();
    const cleanVer = (apiVersion || 'v21.0').trim() || 'v21.0';

    const url = `https://graph.facebook.com/${cleanVer}/${cleanPhoneId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'document',
      document: {
        id: mediaId,
        filename,
        caption
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return {
        success: false,
        message: `Unexpected response from WhatsApp message API (HTTP ${response.status}): ${text.substring(0, 150)}`
      };
    }

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('WhatsApp Document Message Error:', data);
      const errMsg = parseMetaApiError(data, 'Failed to send WhatsApp document message');
      return {
        success: false,
        message: errMsg,
        details: data
      };
    }

    const wamid = data?.messages?.[0]?.id || '';

    return {
      success: true,
      message: 'Invoice PDF document sent successfully on WhatsApp',
      mediaId,
      whatsappMessageId: wamid,
      details: data
    };
  } catch (err: any) {
    console.error('Exception sending WhatsApp document message:', err);
    return {
      success: false,
      message: err.message || 'Error sending WhatsApp document message'
    };
  }
}

export async function sendWhatsAppTemplateDocumentMessage(
  recipientPhone: string,
  mediaId: string,
  filename: string,
  templateName: string,
  templateLanguage: string = 'en_US',
  bodyParameters: string[] = [],
  accessToken: string,
  phoneNumberId: string,
  apiVersion: string = 'v21.0'
): Promise<WhatsAppSendResult> {
  try {
    const cleanPhoneId = (phoneNumberId || '').trim();
    const cleanToken = (accessToken || '').trim();
    const cleanVer = (apiVersion || 'v21.0').trim() || 'v21.0';
    const cleanTemplateName = (templateName || 'invoice_document').trim();
    const cleanLang = (templateLanguage || 'en_US').trim();

    const url = `https://graph.facebook.com/${cleanVer}/${cleanPhoneId}/messages`;

    // Build components: Header (Document attachment) + Body (Text variables)
    const components: any[] = [
      {
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              id: mediaId,
              filename: filename || 'Invoice.pdf'
            }
          }
        ]
      }
    ];

    if (bodyParameters && bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParameters.map((param) => ({
          type: 'text',
          text: String(param || '')
        }))
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'template',
      template: {
        name: cleanTemplateName,
        language: {
          code: cleanLang
        },
        components
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return {
        success: false,
        message: `Unexpected response from WhatsApp message API (HTTP ${response.status}): ${text.substring(0, 150)}`
      };
    }

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('WhatsApp Template Document Message Error:', data);
      const errMsg = parseMetaApiError(data, 'Failed to send WhatsApp template message');
      return {
        success: false,
        message: errMsg,
        details: data
      };
    }

    const wamid = data?.messages?.[0]?.id || '';

    return {
      success: true,
      message: `Invoice PDF sent successfully using template "${cleanTemplateName}"!`,
      mediaId,
      whatsappMessageId: wamid,
      details: data
    };
  } catch (err: any) {
    console.error('Exception sending WhatsApp template document message:', err);
    return {
      success: false,
      message: err.message || 'Error sending WhatsApp template document message'
    };
  }
}
