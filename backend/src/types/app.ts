export type AppEnv = {
    Variables: {
        userId: string;
        businessId: string;
        userEmail: string;
        userRole: string;
    };
};

export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
