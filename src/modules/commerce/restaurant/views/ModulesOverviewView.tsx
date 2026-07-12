import { Boxes, CheckCircle2, Eye, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    getQ360ModulesByWorkspace,
    type ModuleStatus,
    type Q360ModuleDefinition,
} from '@/core/modules';

type StatusSection = {
    status: ModuleStatus;
    title: string;
    description: string;
};

const STATUS_SECTIONS: readonly StatusSection[] = [
    {
        status: 'enabled',
        title: 'Active in this workspace',
        description: 'Operational modules that are available for day-to-day Restaurant work.',
    },
    {
        status: 'preview',
        title: 'Preview modules',
        description: 'Visible for product direction only. These modules are not production-ready yet.',
    },
    {
        status: 'locked',
        title: 'Locked and protected',
        description: 'Core capabilities protected from casual changes because other workflows depend on them.',
    },
    {
        status: 'disabled',
        title: 'Future modules',
        description: 'Planned shared capabilities that are not enabled for operational use.',
    },
];

const STATUS_META: Record<ModuleStatus, { label: string; icon: typeof CheckCircle2; tone: string; wash: string }> = {
    enabled: { label: 'Enabled', icon: CheckCircle2, tone: '#047857', wash: '#ecfdf5' },
    preview: { label: 'Preview', icon: Eye, tone: '#a16207', wash: '#fffbeb' },
    locked: { label: 'Locked', icon: LockKeyhole, tone: '#475569', wash: '#f1f5f9' },
    disabled: { label: 'Future', icon: Boxes, tone: '#6d28d9', wash: '#f5f3ff' },
};

const ModuleCard = ({ module }: { module: Q360ModuleDefinition }) => {
    const meta = STATUS_META[module.status];
    const StatusIcon = meta.icon;

    return (
        <article className="modules-overview-card">
            <div className="modules-overview-card__header">
                <div>
                    <span className="modules-overview-card__workspace">
                        {module.workspaceKey === 'shared' ? 'Shared capability' : 'Restaurant'}
                    </span>
                    <h3>{module.label}</h3>
                </div>
                <span className="modules-overview-badge" style={{ color: meta.tone, background: meta.wash }}>
                    <StatusIcon size={14} aria-hidden="true" />
                    {meta.label}
                </span>
            </div>
            <p>{module.description}</p>
            <div className="modules-overview-card__meta">
                <span>{module.category}</span>
                <span>{module.isShared ? 'Reusable' : 'Workspace-specific'}</span>
            </div>
        </article>
    );
};

export const ModulesOverviewView = () => {
    const restaurantModules = getQ360ModulesByWorkspace('restaurant');
    const sharedModules = getQ360ModulesByWorkspace('shared');
    const visibleModules = [...restaurantModules, ...sharedModules];

    return (
        <ModuleShell padding="clamp(18px, 4vw, 32px)">
            <div className="modules-overview">
                <PageHeader
                    title="Modules"
                    subtitle="See what is active, protected, in preview, or planned for this workspace."
                />

                <section className="modules-overview-notice" aria-label="Read-only module information">
                    <ShieldCheck size={24} aria-hidden="true" />
                    <div>
                        <strong>Read-only overview</strong>
                        <p>
                            Module switches are not enabled yet. Statuses come from the Q360 registry and do not
                            change routes, permissions, stored data, or Restaurant behavior.
                        </p>
                    </div>
                </section>

                {STATUS_SECTIONS.map(section => {
                    const modules = visibleModules.filter(module => module.status === section.status);
                    if (!modules.length) return null;

                    return (
                        <section className="modules-overview-section" key={section.status}>
                            <div className="modules-overview-section__heading">
                                <div>
                                    <h2>{section.title}</h2>
                                    <p>{section.description}</p>
                                </div>
                                <span>{modules.length}</span>
                            </div>
                            <div className="modules-overview-grid">
                                {modules.map(module => (
                                    <ModuleCard
                                        key={`${module.workspaceKey}:${module.moduleKey}`}
                                        module={module}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}

                <section className="modules-overview-footer">
                    <h2>What comes later</h2>
                    <p>
                        Owner-approved controls may later hide low-risk modules without deleting their data.
                        Backend authorization, tenant isolation, and protected Restaurant flows will remain the
                        source of truth.
                    </p>
                </section>
            </div>

            <style>{`
                .modules-overview { max-width: 1180px; margin: 0 auto; color: var(--fg-primary); }
                .modules-overview-notice { display: flex; gap: 14px; align-items: flex-start; margin: -10px 0 30px; padding: 18px; border: 1px solid #bfdbfe; border-radius: 14px; color: #1e3a8a; background: #eff6ff; }
                .modules-overview-notice svg { flex: 0 0 auto; margin-top: 1px; }
                .modules-overview-notice strong { display: block; margin-bottom: 4px; font-size: 15px; }
                .modules-overview-notice p, .modules-overview-section__heading p, .modules-overview-card p, .modules-overview-footer p { margin: 0; color: var(--fg-secondary); line-height: 1.55; }
                .modules-overview-section { margin-bottom: 34px; }
                .modules-overview-section__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 14px; }
                .modules-overview-section__heading h2, .modules-overview-footer h2 { margin: 0 0 5px; font-size: 19px; }
                .modules-overview-section__heading p { font-size: 13px; }
                .modules-overview-section__heading > span { min-width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border-subtle); border-radius: 999px; background: var(--surface-100); color: var(--fg-secondary); font-size: 12px; font-weight: 700; }
                .modules-overview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
                .modules-overview-card { min-width: 0; padding: 18px; border: 1px solid var(--border-subtle); border-radius: 14px; background: white; color: #0f172a; }
                .modules-overview-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
                .modules-overview-card__workspace { color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
                .modules-overview-card h3 { margin: 4px 0 0; font-size: 16px; }
                .modules-overview-card p { min-height: 42px; color: #64748b; font-size: 13px; }
                .modules-overview-badge { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; padding: 6px 9px; border-radius: 999px; font-size: 11px; font-weight: 750; }
                .modules-overview-card__meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
                .modules-overview-card__meta span { padding: 5px 8px; border-radius: 7px; color: #475569; background: #f1f5f9; font-size: 10px; text-transform: capitalize; }
                .modules-overview-footer { padding: 20px; border: 1px dashed var(--border-subtle); border-radius: 14px; background: var(--surface-100); }
                .modules-overview-footer p { max-width: 760px; font-size: 13px; }
                @media (max-width: 720px) {
                    .modules-overview-grid { grid-template-columns: 1fr; }
                    .modules-overview-card p { min-height: 0; }
                    .modules-overview-card__header { align-items: center; }
                }
                @media (max-width: 460px) {
                    .modules-overview-notice { padding: 15px; }
                    .modules-overview-section__heading { gap: 10px; }
                    .modules-overview-card { padding: 15px; }
                    .modules-overview-badge { padding: 5px 7px; }
                }
            `}</style>
        </ModuleShell>
    );
};
