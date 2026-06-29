process.env.JWT_SECRET ||= 'jwt-init-verification-secret-with-sufficient-length';

const { generateToken } = await import('../middleware/auth.js');
const { verify } = await import('hono/jwt');

try {
    const token = await generateToken({
        sub: 'usr_jwt_init',
        email: 'jwt-init@example.com',
        role: 'user',
        businessId: 'biz_jwt_init',
    });

    const payload = await verify(token, process.env.JWT_SECRET, 'HS256') as {
        sub?: string;
        email?: string;
        businessId?: string;
    };

    if (payload.sub !== 'usr_jwt_init' || payload.email !== 'jwt-init@example.com' || payload.businessId !== 'biz_jwt_init') {
        throw new Error('JWT payload did not round-trip through Hono sign/verify');
    }

    console.log(`JWT init verification passed on ${process.version}: Web Crypto is available.`);
} catch (error) {
    console.error('JWT init verification failed:', error);
    process.exitCode = 1;
}
