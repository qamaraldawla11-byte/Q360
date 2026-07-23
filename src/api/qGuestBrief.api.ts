import { http } from './http';

export interface QGuestBriefAnswer {
    question: string;
    answer: string;
}

export interface QGuestBriefRecommendation {
    intent: string;
    businessType: string;
    recommendedWorkspace: string;
    recommendedModules: string[];
    priorities: string[];
    rationale: string;
    requiresApproval: true;
}

export interface QGuestBriefPrefill {
    businessName?: string;
    country?: string;
    currency?: string;
}

export interface QGuestBriefPayload {
    version: number;
    businessSummary: string;
    recommendation: QGuestBriefRecommendation;
    prefill: QGuestBriefPrefill;
    answers: QGuestBriefAnswer[];
    clientMetadata?: Record<string, unknown>;
}

export interface QGuestBriefView {
    id: string;
    state: string;
    payload: QGuestBriefPayload;
    claimedByUserId: string | null;
    claimedAt: string | null;
    confirmedAt: string | null;
    confirmedFields: string[];
    activeExpiresAt: string;
    createdAt: string;
}

export interface CreateGuestBriefInput {
    businessType: string;
    businessName: string;
    country: string;
    currency: string;
    services: string[];
    tables?: number;
    priorities: string[];
    recommendedModules: string[];
    initialRequest: string;
}

export interface CreateGuestBriefResult {
    briefToken: string;
    activeExpiresAt: string;
}

export interface ClaimGuestBriefResult {
    outcome: 'claimed' | 'already_claimed';
    brief: QGuestBriefView;
}

export interface CurrentGuestBriefResult {
    brief: QGuestBriefView | null;
}

export interface ConfirmGuestBriefInput {
    acceptedFields: string[];
    corrections?: {
        businessName?: string;
        country?: string;
        currency?: string;
    };
}

export interface QGuestBriefConfirmResult {
    success: true;
    outcome: 'confirmed' | 'already_confirmed';
    workspace: string;
    destination: string;
    tablesEnsured: number;
    tablesCreated: number;
}

export interface DismissGuestBriefResult {
    outcome: 'dismissed' | 'no_active_brief';
}

export const createGuestBrief = (input: CreateGuestBriefInput): Promise<CreateGuestBriefResult> =>
    http.post<CreateGuestBriefResult>('/public/q-concierge/brief', input);

export const claimGuestBrief = (briefToken: string): Promise<ClaimGuestBriefResult> =>
    http.post<ClaimGuestBriefResult>('/q/guest-briefs/claim', { briefToken });

export const getCurrentGuestBrief = (): Promise<CurrentGuestBriefResult> =>
    http.get<CurrentGuestBriefResult>('/q/guest-briefs/current');

export const confirmGuestBrief = (input: ConfirmGuestBriefInput): Promise<QGuestBriefConfirmResult> =>
    http.post<QGuestBriefConfirmResult>('/q/guest-briefs/current/confirm', input);

export const dismissGuestBrief = (): Promise<DismissGuestBriefResult> =>
    http.post<DismissGuestBriefResult>('/q/guest-briefs/current/dismiss');

const currencyByCountry: Record<string, string> = {
    spain: 'EUR',
    france: 'EUR',
    germany: 'EUR',
    uae: 'AED',
    ae: 'AED',
    'united arab emirates': 'AED',
    egypt: 'EGP',
    eg: 'EGP',
    uk: 'GBP',
    gb: 'GBP',
    'united kingdom': 'GBP',
    us: 'USD',
    usa: 'USD',
    'united states': 'USD',
};

export const currencyForCountry = (country: string): string =>
    currencyByCountry[country.trim().toLowerCase()] || 'USD';
