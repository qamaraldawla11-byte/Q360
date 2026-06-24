import { Resend } from 'resend';

const EXPECTED_EMAIL_FROM = 'Q360 <no-reply@send.q360.app>';

const maskEmail = (email: string): string => {
    const [localPart = '', domain = 'invalid'] = email.trim().split('@', 2);
    return `${localPart.charAt(0) || '*'}***@${domain || 'invalid'}`;
};

export const sendOtpEmail = async (email: string, code: string): Promise<void> => {
    const maskedRecipient = maskEmail(email);

    try {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.EMAIL_FROM;

        if (!apiKey || from !== EXPECTED_EMAIL_FROM) {
            throw new Error('email delivery configuration is invalid');
        }

        const resend = new Resend(apiKey);
        const { error } = await resend.emails.send({
            from,
            to: [email],
            subject: 'Your Q360 sign-in code',
            text: `Your Q360 sign-in code is ${code}. It expires in 10 minutes.`,
            html: `
                <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
                    <h2 style="margin-bottom:8px">Sign in to Q360</h2>
                    <p>Enter this code to finish signing in:</p>
                    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
                    <p style="color:#64748b">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
                </div>
            `,
        });

        if (error) {
            throw new Error('Resend rejected the email request');
        }
    } catch {
        throw new Error(`OTP email delivery failed for ${maskedRecipient}`);
    }
};
