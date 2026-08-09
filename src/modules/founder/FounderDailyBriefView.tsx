import { useEffect, useState } from 'react';
import axios from 'axios';
import { LoaderCircle, ShieldAlert } from 'lucide-react';
import {
    founderBriefApi,
    type FounderBriefEvidence,
    type FounderBriefSection,
    type FounderDailyBrief,
} from '@/api/founderBrief.api';
import './founder.css';

// Q360-QB-M4-S2: Founder Daily Brief page (read-only).
//
// Renders the deterministic brief exactly as structured by the backend:
// facts are separated from unknowns, unavailable/postponed sections are
// explicit states, and every text value is rendered through React's escaped
// interpolation only — no dangerouslySetInnerHTML, no markdown/HTML rendering,
// no action buttons or approval controls.

const STATUS_LABELS: Record<FounderBriefSection['status'], string> = {
    supported: 'Supported',
    partial: 'Partial',
    unavailable: 'Unavailable',
    postponed: 'Postponed',
};

const humanize = (key: string) => {
    const text = key.replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
};

const formatValue = (evidence: FounderBriefEvidence) => {
    if (evidence.displayText) return evidence.displayText;
    if (evidence.value === null || evidence.value === undefined) return '—';
    return String(evidence.value);
};

type LoadState =
    | { status: 'loading' }
    | { status: 'ready'; brief: FounderDailyBrief }
    | { status: 'error'; httpStatus: number | null; message: string };

const errorStateFor = (error: unknown): LoadState => {
    if (axios.isAxiosError(error)) {
        const httpStatus = error.response?.status ?? null;
        if (httpStatus === 401) {
            return { status: 'error', httpStatus, message: 'Your session could not be verified. Please sign in again.' };
        }
        if (httpStatus === 403) {
            return { status: 'error', httpStatus, message: 'This account is not permitted to view the Founder Daily Brief.' };
        }
        if (httpStatus !== null && httpStatus >= 500) {
            return { status: 'error', httpStatus, message: 'The Founder Daily Brief could not be generated on the server. Please try again later.' };
        }
        return { status: 'error', httpStatus, message: 'Cannot reach the server. Check your connection and try again.' };
    }
    return { status: 'error', httpStatus: null, message: 'The Founder Daily Brief could not be loaded.' };
};

const BriefSectionCard = ({ section }: { section: FounderBriefSection }) => (
    <article className={`founder-card founder-card--${section.status}`}>
        <header className="founder-card-head">
            <h2 className="founder-card-title">{section.title}</h2>
            <span className={`founder-status founder-status--${section.status}`}>
                {STATUS_LABELS[section.status]}
            </span>
        </header>

        {section.facts.length > 0 && (
            <ul className="founder-facts">
                {section.facts.map((fact, index) => (
                    <li key={`${fact.fact}-${fact.sourceId ?? index}`} className="founder-fact">
                        <span className="founder-fact-label">{humanize(fact.fact)}</span>
                        <span className="founder-fact-value">
                            {formatValue(fact)}
                            {fact.truncated ? <span className="founder-tag">truncated</span> : null}
                            {fact.confidence === 'estimated'
                                ? <span className="founder-tag founder-tag--estimated">estimated</span>
                                : null}
                        </span>
                    </li>
                ))}
            </ul>
        )}

        {section.unknowns.length > 0 && (
            <div className="founder-unknowns">
                <h3 className="founder-unknowns-title">Unknowns</h3>
                <ul className="founder-unknowns-list">
                    {section.unknowns.map((unknown, index) => (
                        <li key={`${unknown.fact}-${index}`} className="founder-unknown">
                            <span className="founder-unknown-fact">{humanize(unknown.fact)}</span>
                            <span className="founder-unknown-reason">{unknown.unknownReason}</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {section.facts.length === 0 && section.unknowns.length === 0 && (
            <p className="founder-empty">No data points.</p>
        )}
    </article>
);

export const FounderDailyBriefView = () => {
    const [state, setState] = useState<LoadState>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;
        founderBriefApi.getDailyBrief()
            .then((brief) => {
                if (!cancelled) setState({ status: 'ready', brief });
            })
            .catch((error) => {
                if (!cancelled) setState(errorStateFor(error));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <section className="founder-page">
            <header className="founder-header">
                <h1 className="founder-title">Founder Daily Brief</h1>
                <p className="founder-subtitle">
                    Deterministic, read-only summary of your business data. No AI-generated analysis.
                </p>
                {state.status === 'ready' && (
                    <p className="founder-meta">
                        Generated {new Date(state.brief.generatedAt).toLocaleString()} · {state.brief.timezone}
                    </p>
                )}
            </header>

            {state.status === 'loading' && (
                <div className="founder-loading" role="status">
                    <LoaderCircle className="founder-spin" size={20} />
                    <span>Loading Founder Daily Brief…</span>
                </div>
            )}

            {state.status === 'error' && (
                <div className="founder-error" role="alert">
                    <ShieldAlert size={20} />
                    <div>
                        {state.httpStatus !== null ? `HTTP ${state.httpStatus} — ` : ''}
                        {state.message}
                    </div>
                </div>
            )}

            {state.status === 'ready' && (
                <div className="founder-grid">
                    {state.brief.sections.map((section) => (
                        <BriefSectionCard key={section.key} section={section} />
                    ))}
                </div>
            )}
        </section>
    );
};
