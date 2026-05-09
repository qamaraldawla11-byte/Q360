import { MOCK_DASHBOARD_STATS } from '../mocks/stats.mock';
import type { DashboardStats } from '../mocks/stats.mock';
import { MOCK_REPORTS } from '../mocks/reports.mock';
import type { Report } from '../mocks/reports.mock';

class StatsService {
    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getDashboardStats(): Promise<DashboardStats> {
        await this.delay(300);
        return MOCK_DASHBOARD_STATS;
    }

    async getReports(): Promise<Report[]> {
        await this.delay(200);
        return MOCK_REPORTS;
    }
}

export const statsService = new StatsService();
