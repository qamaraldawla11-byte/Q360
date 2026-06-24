import nodemailer from 'nodemailer';

const useJsonTransport = process.env.SMTP_JSON_TRANSPORT === 'true';

const createTransport = () => {
    if (useJsonTransport) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SMTP_JSON_TRANSPORT cannot be used in production');
        }

        return nodemailer.createTransport({ jsonTransport: true });
    }

    const host = process.env.SMTP_HOST;
    if (!host) {
        throw new Error('SMTP_HOST is not configured');
    }

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    return nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: user && pass ? { user, pass } : undefined,
    });
};

export const sendOtpEmail = async (email: string, code: string): Promise<void> => {
    const transporter = createTransport();
    const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'One OS <no-reply@one-os.local>',
        to: email,
        subject: 'Your One OS sign-in code',
        text: `Your One OS sign-in code is ${code}. It expires in 10 minutes.`,
        html: `
            <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
                <h2 style="margin-bottom:8px">Sign in to One OS</h2>
                <p>Enter this code to finish signing in:</p>
                <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
                <p style="color:#64748b">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
            </div>
        `,
    });

    if (useJsonTransport) {
        const message = (info as { message?: string | Buffer }).message;
        console.info(`[AUTH] Development OTP email: ${String(message)}`);
    }
};
