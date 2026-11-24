// Applicant messages: fixed Kannada templates (not AI-written). Sent through an SMS/WhatsApp webhook if SMS_WEBHOOK_URL is set,
// otherwise they stay 'queued' in the outbox. Indian SMS also needs DLT-registered templates: register these texts.
import { config } from '../config/index.js';
import { Notification } from '../models/Notification.js';

export const notice = (a, action, remark) => {
  const hi = `ನಮಸ್ಕಾರ ${a.name}, ನಿಮ್ಮ ಪಿಂಚಣಿ ಅರ್ಜಿ ${a.ref_no}`;
  if (action === 'advance' && a.stage === 1) return `${hi} ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ರಾಜಸ್ವ ನಿರೀಕ್ಷಕರು ಶೀಘ್ರದಲ್ಲೇ ನಿಮ್ಮ ಮನೆಗೆ ಭೇಟಿ ನೀಡುತ್ತಾರೆ. ದಯವಿಟ್ಟು ಮನೆಯಲ್ಲಿರಿ.`;
  if (action === 'return') return `${hi} ಹಿಂತಿರುಗಿಸಲಾಗಿದೆ. ಕಾರಣ: ${remark}. ದಯವಿಟ್ಟು ದಾಖಲೆಗಳೊಂದಿಗೆ ಗ್ರಾಮ ಕಚೇರಿಗೆ ಬನ್ನಿ.`;
  if (action === 'approve') return `${hi} ಮಂಜೂರಾಗಿದೆ. ಪಿಂಚಣಿ ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಜಮೆ ಆಗುತ್ತದೆ.`;
  if (action === 'reject') return `${hi} ತಿರಸ್ಕರಿಸಲಾಗಿದೆ. ಕಾರಣ: ${remark}. ವಿವರಕ್ಕೆ ತಹಶೀಲ್ದಾರ್ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.`;
  return null;
};

// Inside the workflow transaction: queue a message if this action warrants one and the applicant has a phone.
export async function queueFor(c, a, action, remark) {
  const body = notice(a, action, remark);
  return body && a.phone ? Notification.create(c, { applicationId: a.id, phone: a.phone, body }) : null;
}

// After commit: hand it to the gateway. Without a gateway it stays 'queued'.
export async function deliver(id) {
  const n = await Notification.find(id);
  let status = 'queued';
  if (config.smsWebhookUrl) {
    try {
      const r = await fetch(config.smsWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: n.phone, message: n.body }), signal: AbortSignal.timeout(15000) });
      status = r.ok ? 'sent' : 'failed';
    } catch { status = 'failed'; }
  }
  await Notification.setStatus(id, status);
}
