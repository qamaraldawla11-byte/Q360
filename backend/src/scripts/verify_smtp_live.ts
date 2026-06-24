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

const hasLiveSmtpConfiguration = () =>
    Boolean(
        process.env.SMTP_HOST
        && process.env.SMTP_USER
        && process.env.SMTP_PASS
        && process.env.SMTP_FROM,
    )
    && process.env.SMTP_JSON_TRANSPORT !== 'true';

try {
    if (!EMAIL_PATTERN.test(recipient)) {
        throw new Error('invalid recipient');
    }

    if (!hasLiveSmtpConfiguration()) {
        throw new Error('invalid SMTP configuration');
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const { sendOtpEmail } = await import('../services/email.js');
    await sendOtpEmail(recipient, code);

    console.info(`SMTP live verification succeeded for ${maskedRecipient}.`);
} catch {
    console.error(`SMTP live verification failed for ${maskedRecipient}.`);
    process.exitCode = 1;
}
