import { MOCK_OFFERS } from '../mocks/offers.mock';
import type { Offer } from '../mocks/offers.mock';

class PromotionsService {
    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getOffers(): Promise<Offer[]> {
        await this.delay(200);
        return MOCK_OFFERS;
    }
}

export const promotionsService = new PromotionsService();
