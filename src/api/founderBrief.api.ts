import { http } from './http';

// Q360-QB-M4-S2: Founder Daily Brief API.
// Read-only: the only operation is getDailyBrief(). The tenant scope is always
// derived server-side from the authenticated session — no businessId is ever
// sent by the client. No mutations exist for this resource.

export type BriefSensitivity = 'low' | 'medium';
export type BriefConfidence = 'high' | 'estimated';

export interface FounderBriefEvidence {
    sourceType: string;
    sourceId: string | null;
    businessId: string;
    observedAt: string;
    fact: string;
    value: number | string | null;
    sensitivity: BriefSensitivity;
    confidence: BriefConfidence;
    provenance: string;
    displayText?: string;
    truncated?: boolean;
    unknownReason?: string;
}

export interface FounderBriefUnknown {
    fact: string;
    unknownReason: string;
}

export interface FounderBriefSection {
    key: string;
    title: string;
    status: 'supported' | 'partial' | 'unavailable' | 'postponed';
    facts: FounderBriefEvidence[];
    unknowns: FounderBriefUnknown[];
}

export interface FounderDailyBrief {
    businessId: string;
    generatedAt: string;
    timezone: string;
    sections: FounderBriefSection[];
}

export const founderBriefApi = {
    getDailyBrief: () => http.get<FounderDailyBrief>('/founder/daily-brief'),
};
