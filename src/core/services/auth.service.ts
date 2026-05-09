class AuthService {
    async login() {
        // Placeholder
        return true;
    }

    async logout() {
        // Placeholder
    }

    getCurrentUser() {
        return { id: 'admin', name: 'Admin User', role: 'admin' };
    }
}

export const authService = new AuthService();
