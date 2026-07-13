import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChefHat, ContactRound, LayoutDashboard, LayoutGrid, Loader2, LockKeyhole, Package, Receipt, Search, ShieldCheck, ShoppingCart, Users, UtensilsCrossed, WalletCards } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import type { BusinessModule } from '@/api/business.api';
import { useBusinessModulesStore } from '@/store/businessModules.store';

const ICONS: Record<string, typeof LayoutGrid> = {
    dashboard: LayoutDashboard, pos: ShoppingCart, kds: ChefHat, menu: UtensilsCrossed,
    tables: LayoutGrid, payments: Receipt, 'daily-report': BarChart3, inventory: Package, staff: Users,
    finance: WalletCards, customers: ContactRound,
};
const CATEGORIES = ['All', 'Core', 'Operations', 'Management'] as const;

const ModuleCard = ({ module, busy, onToggle }: { module: BusinessModule; busy: boolean; onToggle: (module: BusinessModule) => void }) => {
    const Icon = ICONS[module.moduleKey] || LayoutGrid;
    const protectedModule = module.availability === 'ready' && !module.configurable;
    return (
        <article className={`module-drawer-card${module.enabled ? ' module-drawer-card--enabled' : ''}`}>
            <div className="module-drawer-icon"><Icon size={25} /></div>
            <div className="module-drawer-content">
                <div className="module-drawer-title"><h3>{module.label}</h3>{module.enabled && <span>Enabled</span>}</div>
                <p>{module.description}</p>
                <small>{module.category}</small>
            </div>
            {module.configurable ? (
                <button type="button" className={module.enabled ? 'module-remove' : 'module-add'} disabled={busy} onClick={() => onToggle(module)}>
                    {busy ? <Loader2 size={15} /> : null}{module.enabled ? 'Disable' : 'Enable'}
                </button>
            ) : (
                <div className={`module-state ${module.availability === 'preview' ? 'module-state--preview' : ''}`}>
                    {protectedModule ? <LockKeyhole size={14} /> : <ShieldCheck size={14} />}
                    {protectedModule ? 'Required' : 'Coming later'}
                </div>
            )}
        </article>
    );
};

export const ModulesOverviewView = () => {
    const modules = useBusinessModulesStore(state => state.modules);
    const loading = useBusinessModulesStore(state => state.loading);
    const load = useBusinessModulesStore(state => state.load);
    const setEnabled = useBusinessModulesStore(state => state.setEnabled);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<typeof CATEGORIES[number]>('All');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => { void load(true).catch(() => setMessage({ kind: 'error', text: 'Unable to load modules.' })); }, [load]);
    const visible = useMemo(() => modules.filter(module => {
        const matchesCategory = category === 'All' || module.category === category;
        const text = `${module.label} ${module.description}`.toLowerCase();
        return matchesCategory && text.includes(query.trim().toLowerCase());
    }), [category, modules, query]);

    const toggle = async (module: BusinessModule) => {
        setBusy(module.moduleKey); setMessage(null);
        if (module.enabled && !window.confirm(`Disable ${module.label}? It will disappear from navigation, but saved data will not be deleted.`)) return;
        try {
            await setEnabled(module.moduleKey, !module.enabled);
            setMessage({ kind: 'success', text: module.enabled ? `${module.label} disabled and removed from navigation. Saved data was not deleted.` : `${module.label} enabled for this workspace.` });
        } catch (error) {
            setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to update module' });
        } finally { setBusy(null); }
    };

    return (
        <ModuleShell padding="clamp(18px,4vw,32px)">
            <div className="module-drawer">
                <PageHeader title="Add Modules" subtitle="Choose the tools shown in this Restaurant workspace." />
                <section className="module-drawer-notice"><ShieldCheck size={21} /><div><strong>Safe workspace controls</strong><p>Removing a module hides it and prevents new use where appropriate. It never deletes saved data. Protected workflow modules remain required.</p></div></section>
                {message && <div className={`module-drawer-message module-drawer-message--${message.kind}`}>{message.text}</div>}
                <div className="module-drawer-tools">
                    <label><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search modules" /></label>
                    <div>{CATEGORIES.map(option => <button type="button" key={option} className={category === option ? 'active' : ''} onClick={() => setCategory(option)}>{option}</button>)}</div>
                </div>
                {loading && !modules.length ? <div className="module-drawer-loading"><Loader2 size={20} /> Loading modules...</div> : (
                    <div className="module-drawer-grid">{visible.map(module => <ModuleCard key={module.moduleKey} module={module} busy={busy === module.moduleKey} onToggle={toggle} />)}</div>
                )}
                {!loading && !visible.length && <div className="module-drawer-empty">No modules match your search.</div>}
            </div>
            <style>{`
                .module-drawer{max-width:1120px;margin:0 auto;color:var(--fg-primary)}.module-drawer-notice{display:flex;gap:12px;padding:16px;margin:-8px 0 20px;border:1px solid #bfdbfe;border-radius:14px;background:#eff6ff;color:#1e3a8a}.module-drawer-notice svg{flex:none}.module-drawer-notice strong{display:block;margin-bottom:3px}.module-drawer-notice p{margin:0;color:#475569;font-size:13px;line-height:1.5}.module-drawer-message{margin-bottom:16px;padding:12px 14px;border-radius:9px;font-size:13px}.module-drawer-message--success{border:1px solid #a7f3d0;background:#ecfdf5;color:#047857}.module-drawer-message--error{border:1px solid #fecaca;background:#fef2f2;color:#b91c1c}.module-drawer-tools{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:20px}.module-drawer-tools label{min-width:250px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#64748b}.module-drawer-tools input{width:100%;height:42px;border:0;outline:0;background:transparent;color:#0f172a;font:inherit}.module-drawer-tools>div{display:flex;gap:7px;flex-wrap:wrap}.module-drawer-tools button{padding:8px 12px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#475569;cursor:pointer;font:inherit;font-size:12px;font-weight:700}.module-drawer-tools button.active{border-color:#f97316;background:#fff7ed;color:#c2410c}.module-drawer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.module-drawer-card{position:relative;display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:14px;align-items:start;padding:18px;border:1px solid #d8dee8;border-radius:16px;background:#fff;color:#0f172a}.module-drawer-card--enabled{border-color:#bbf7d0}.module-drawer-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:14px;background:#f1f5f9;color:#475569}.module-drawer-card--enabled .module-drawer-icon{background:#ecfdf5;color:#047857}.module-drawer-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.module-drawer-title h3{margin:0;font-size:16px}.module-drawer-title span{padding:4px 7px;border-radius:999px;background:#dcfce7;color:#047857;font-size:10px;font-weight:800}.module-drawer-content p{min-height:40px;margin:7px 0 10px;color:#64748b;font-size:12px;line-height:1.45}.module-drawer-content small{color:#94a3b8;font-weight:700}.module-add,.module-remove{min-width:76px;min-height:34px;display:flex;align-items:center;justify-content:center;gap:5px;border-radius:9px;cursor:pointer;font:inherit;font-size:12px;font-weight:800}.module-add{border:0;background:#f97316;color:#fff}.module-remove{border:1px solid #cbd5e1;background:#fff;color:#475569}.module-state{display:flex;align-items:center;gap:5px;padding:7px 9px;border-radius:9px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:800}.module-state--preview{background:#fffbeb;color:#a16207}.module-drawer-loading,.module-drawer-empty{padding:34px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b}@media(max-width:760px){.module-drawer-grid{grid-template-columns:1fr}.module-drawer-tools{align-items:stretch;flex-direction:column}.module-drawer-tools label{min-width:0}.module-drawer-card{grid-template-columns:46px minmax(0,1fr)}.module-drawer-icon{width:46px;height:46px}.module-add,.module-remove,.module-state{grid-column:2;width:max-content}.module-drawer-content p{min-height:0}}
            `}</style>
        </ModuleShell>
    );
};
