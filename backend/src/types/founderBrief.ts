// Q360-QB-M4-S2: Founder Daily Brief transient contract.
//
// Evidence objects are computed deterministically per request and are NEVER
// persisted: no brief history, no decision ledger, no permanent memory is
// written by this slice. The contract is deliberately minimal and structured
// so display text stays separated from machine facts.

export type BriefSensitivity = 'low' | 'medium';
export type BriefConfidence = 'high' | 'estimated';

export type FounderBriefSectionStatus = 'supported' | 'partial' | 'unavailable' | 'postponed';

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
    status: FounderBriefSectionStatus;
    facts: FounderBriefEvidence[];
    unknowns: FounderBriefUnknown[];
}

export interface FounderDailyBrief {
    businessId: string;
    generatedAt: string;
    timezone: string;
    sections: FounderBriefSection[];
}
