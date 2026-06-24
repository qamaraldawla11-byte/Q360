import 'dotenv/config';

import { randomInt } from 'node:crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const maskEmail = (email: string): string => {
    const [localPart = '', domain = 'invalid'] = email.trim().split('@', 2);
    const firstCharacter = localPart.charAt(0) || '*';
    return `${firstCharacter}***@${domain || 'invalid'}`;
};

const recipient = process.env.VERIFY_EMAIL?.trim() || '';
const maskedRecipient = maskEmail(recipient);

const hasLiveResendConfiguration = () =>
    Boolean(process.env.RESEND_API_KEY)
    && process.env.EMAIL_FROM === 'Q360 <no-reply@send.q360.app>';

try {
    if (!EMAIL_PATTERN.test(recipient)) {
        throw new Error('invalid recipient');
    }

    if (!hasLiveResendConfiguration()) {
        throw new Error('invalid Resend configuration');
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const { sendOtpEmail } = await import('../services/email.js');
    await sendOtpEmail(recipient, code);

    console.info(`Resend live verification succeeded for ${maskedRecipient}.`);
} catch {
    console.error(`Resend live verification failed for ${maskedRecipient}.`);
    process.exitCode = 1;
}
