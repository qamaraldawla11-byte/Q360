import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Clock, Mail, Pencil, Save, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { staffApi, type StaffMember } from '@/api/staff.api';

const MODULES = [['dashboard', 'Dashboard'], ['pos', 'Sales'], ['kds', 'Kitchen'], ['menu', 'Menu'], ['tables', 'Tables'], ['inventory', 'Stock'], ['daily-report', 'Reports']] as const;
const emptyForm = { name: '', email: '', role: 'staff', moduleAccess: ['dashboard'], shiftName: '', shiftStart: '', shiftEnd: '' };
type StaffForm = typeof emptyForm;
const normalizeAccess = (access: string[]) => {
    const next = access.filter(key => key !== 'payments');
    if (access.includes('payments') && !next.includes('pos')) next.push('pos');
    return [...new Set(next)];
};
const roleLabel = (role: string) => role === 'waiter' ? 'Waiter / Server' : role.charAt(0).toUpperCase() + role.slice(1);

const AccessChoices = ({ value, onToggle }: { value: string[]; onToggle: (key: string) => void }) => <div className="staff-modules"><b>Workspace access</b><p>Payments are included inside Sales.</p><div>{MODULES.map(([key, label]) => <label key={key}><input type="checkbox" checked={value.includes(key)} onChange={() => onToggle(key)} />{label}</label>)}</div></div>;

export const StaffView = () => {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState('');
    const [form, setForm] = useState<StaffForm>(emptyForm);
    const [editing, setEditing] = useState<StaffMember | null>(null);
    const [editForm, setEditForm] = useState<StaffForm>(emptyForm);

    const load = useCallback(async () => {
        try { setStaff(await staffApi.list()); setError(''); }
        catch { setError('Unable to load staff records.'); }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const toggle = (target: 'invite' | 'edit', key: string) => {
        const update = (current: StaffForm) => ({ ...current, moduleAccess: current.moduleAccess.includes(key) ? current.moduleAccess.filter(value => value !== key) : [...current.moduleAccess, key] });
        if (target === 'invite') setForm(update); else setEditForm(update);
    };
    const invite = async (event: FormEvent) => {
        event.preventDefault(); setBusy('invite'); setMessage('');
        try {
            const result = await staffApi.invite({ ...form, moduleAccess: normalizeAccess(form.moduleAccess) });
            setMessage(result.emailDelivered ? 'Invitation email sent.' : 'Staff saved, but email delivery is not configured. They can still sign in with the invited email.');
            setForm(emptyForm); await load();
        } catch { setError('Unable to invite staff member.'); } finally { setBusy(''); }
    };
    const beginEdit = (person: StaffMember) => {
        setEditing(person);
        setEditForm({ name: person.name, email: person.email, role: person.role, moduleAccess: normalizeAccess(person.moduleAccess), shiftName: person.shiftName || '', shiftStart: person.shiftStart || '', shiftEnd: person.shiftEnd || '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const saveEdit = async (event: FormEvent) => {
        event.preventDefault(); if (!editing) return; setBusy('edit'); setMessage('');
        try {
            await staffApi.update(editing.id, { name: editForm.name, role: editForm.role, moduleAccess: normalizeAccess(editForm.moduleAccess), shiftName: editForm.shiftName, shiftStart: editForm.shiftStart, shiftEnd: editForm.shiftEnd });
            setEditing(null); await load(); setMessage('Staff details and access updated. Changes apply at the next sign-in.');
        } catch { setError('Unable to update staff details.'); } finally { setBusy(''); }
    };
    const changeStatus = async (person: StaffMember) => {
        setBusy(person.id);
        try { await staffApi.update(person.id, { status: person.status === 'inactive' ? 'active' : 'inactive' }); await load(); setMessage(person.status === 'inactive' ? 'Staff access activated.' : 'Staff access deactivated.'); }
        catch { setError('Unable to change staff access.'); } finally { setBusy(''); }
    };

    return <ModuleShell><PageHeader title="Team" subtitle="Invite team members and manage each person’s role, shift, and workspace access." />
        {error && <div className="staff-alert error">{error}</div>}{message && <div className="staff-alert success">{message}</div>}
        <div className="staff-summary"><article><Users /><b>{staff.length}</b><span>Total staff</span></article><article><ShieldCheck /><b>{staff.filter(person => person.status === 'active').length}</b><span>Active</span></article><article><Mail /><b>{staff.filter(person => person.status === 'invited').length}</b><span>Invited</span></article></div>

        {editing && <form className="staff-form staff-edit" onSubmit={saveEdit}><div className="staff-heading"><Pencil /><div><h2>Edit staff member</h2><p>Staff access is managed here and remains separate from Business Settings.</p></div><button type="button" className="staff-close" onClick={() => setEditing(null)} aria-label="Close editor"><X size={18} /></button></div>
            <div className="staff-fields"><label>Full name<input required value={editForm.name} onChange={event => setEditForm({ ...editForm, name: event.target.value })} /></label><label>Email <span>(sign-in identity)</span><input value={editForm.email} readOnly disabled /></label><label>Role<select value={editForm.role} onChange={event => setEditForm({ ...editForm, role: event.target.value })}><option value="manager">Manager</option><option value="waiter">Waiter / Server</option><option value="cashier">Cashier</option><option value="kitchen">Kitchen</option><option value="staff">Staff</option></select></label><label>Shift name<input placeholder="e.g. Morning" value={editForm.shiftName} onChange={event => setEditForm({ ...editForm, shiftName: event.target.value })} /></label><label>Shift starts<input type="time" value={editForm.shiftStart} onChange={event => setEditForm({ ...editForm, shiftStart: event.target.value })} /></label><label>Shift ends<input type="time" value={editForm.shiftEnd} onChange={event => setEditForm({ ...editForm, shiftEnd: event.target.value })} /></label></div>
            <AccessChoices value={editForm.moduleAccess} onToggle={key => toggle('edit', key)} /><button className="staff-primary" disabled={busy === 'edit'}><Save size={16} />{busy === 'edit' ? 'Saving…' : 'Save staff changes'}</button>
        </form>}

        <form className="staff-form staff-invite" onSubmit={invite}><div className="staff-heading"><UserPlus /><div><h2>Invite staff member</h2><p>They receive an invitation and accept through secure email OTP sign-in.</p></div></div>
            <div className="staff-fields"><label>Full name<input required placeholder="Full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Email<input required type="email" placeholder="staff@example.com" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Role<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="manager">Manager</option><option value="waiter">Waiter / Server</option><option value="cashier">Cashier</option><option value="kitchen">Kitchen</option><option value="staff">Staff</option></select></label><label>Shift name<input placeholder="e.g. Evening" value={form.shiftName} onChange={event => setForm({ ...form, shiftName: event.target.value })} /></label><label>Shift starts<input type="time" value={form.shiftStart} onChange={event => setForm({ ...form, shiftStart: event.target.value })} /></label><label>Shift ends<input type="time" value={form.shiftEnd} onChange={event => setForm({ ...form, shiftEnd: event.target.value })} /></label></div>
            <AccessChoices value={form.moduleAccess} onToggle={key => toggle('invite', key)} /><button className="staff-primary" disabled={busy === 'invite'}><Mail size={16} />{busy === 'invite' ? 'Sending…' : 'Send invitation'}</button>
        </form>

        <div className="staff-grid">{staff.map(person => { const access = normalizeAccess(person.moduleAccess); return <article key={person.id}><div className="staff-card-head"><div className="staff-avatar">{person.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div><span className={`staff-status ${person.status}`}>{person.status}</span></div><h3>{person.name}</h3><p>{person.email}</p><b className="staff-role">{roleLabel(person.role)}</b><div className="staff-shift"><Clock size={14} />{person.shiftName || 'No shift'} {person.shiftStart && `${person.shiftStart}–${person.shiftEnd || ''}`}</div><div className="staff-access">{access.map(key => <span key={key}>{MODULES.find(module => module[0] === key)?.[1] || key}</span>)}</div><div className="staff-actions"><button type="button" onClick={() => beginEdit(person)}><Pencil size={14} /> Edit details</button><button type="button" disabled={busy === person.id} onClick={() => void changeStatus(person)}>{person.status === 'inactive' ? 'Activate' : 'Deactivate'}</button></div></article>; })}</div>
        <style>{`
        .staff-alert{padding:12px;margin-bottom:14px;border-radius:8px}.staff-alert.error{background:#fef2f2;color:#b91c1c}.staff-alert.success{background:#ecfdf5;color:#047857}.staff-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.staff-summary article{display:grid;grid-template-columns:38px 1fr;padding:15px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:12px}.staff-summary svg{grid-row:1/3;color:#f97316}.staff-summary b{font-size:23px}.staff-summary span{font-size:12px;color:#64748b}.staff-form{padding:18px;margin-bottom:20px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:14px}.staff-edit{border:2px solid #fb923c}.staff-heading{display:flex;gap:10px;position:relative}.staff-heading>svg{color:#f97316}.staff-heading h2{margin:0;font-size:18px}.staff-heading p{margin:3px 0 15px;color:#64748b;font-size:12px}.staff-close{margin-left:auto;width:36px;height:36px;display:grid;place-items:center;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#475569}.staff-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.staff-fields label{display:flex;flex-direction:column;gap:5px;color:#334155;font-size:12px;font-weight:800}.staff-fields label span{font-weight:500;color:#64748b}.staff-fields input,.staff-fields select{min-height:42px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a}.staff-fields input:disabled{background:#f1f5f9;color:#64748b}.staff-modules{margin:14px 0}.staff-modules>p{margin:3px 0 0;color:#64748b;font-size:11px}.staff-modules>div{display:flex;flex-wrap:wrap;gap:8px;margin-top:7px}.staff-modules label{padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px}.staff-primary{min-height:40px;padding:8px 14px;display:flex;gap:7px;align-items:center;border:0;border-radius:8px;background:#f97316;color:#fff;font-weight:700}.staff-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:13px}.staff-grid article{padding:17px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:14px}.staff-card-head{display:flex;justify-content:space-between}.staff-avatar{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:#fff7ed;color:#c2410c;font-weight:800}.staff-status{padding:5px 8px;height:max-content;border-radius:99px;font-size:11px;text-transform:capitalize}.staff-status.active{background:#dcfce7;color:#166534}.staff-status.invited{background:#dbeafe;color:#1e40af}.staff-status.inactive{background:#f1f5f9;color:#475569}.staff-grid h3{margin:12px 0 2px}.staff-grid p{margin:0;color:#64748b;font-size:12px}.staff-role{display:block;margin:8px 0}.staff-shift{display:flex;gap:6px;color:#64748b;font-size:12px}.staff-access{display:flex;flex-wrap:wrap;gap:5px;margin:12px 0}.staff-access span{padding:4px 6px;border-radius:6px;background:#f1f5f9;color:#475569;font-size:10px}.staff-actions{display:flex;gap:7px}.staff-actions button{min-height:36px;display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 10px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#475569}.staff-actions button:first-child{flex:1;color:#c2410c;border-color:#fed7aa}@media(max-width:700px){.staff-fields{grid-template-columns:1fr}.staff-summary{grid-template-columns:1fr}.staff-actions{flex-direction:column}}
        `}</style>
    </ModuleShell>;
};
