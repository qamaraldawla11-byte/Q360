import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Copy,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  MapPin,
  Package,
  Send,
  Settings,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { http } from '@/api/http';
import { currencyForCountry } from '@/api/qGuestBrief.api';
import { LogoMark } from '@/components/ui/Logo';
import {
  emailPattern,
  FIELD_ORDER,
  fallbackModules,
  fieldDefByKey,
  formatFieldValue,
  initialJourney,
  initialSetup,
  isChangeMessage,
  isConfirmMessage,
  isContinueMessage,
  isOwnerNameStatement,
  isSkipMessage,
  listOf,
  mergeSetup,
  nextField,
  ownerNameFromStatement,
  parseActiveAnswer,
  requiredComplete,
  requiredFields,
  requiredProgress,
  syncJourney,
  textOf,
  type FieldKey,
  type FieldStatus,
  type GuestSetup,
} from './guestQConciergeState';

export type { GuestSetup } from './guestQConciergeState';

const isQuestionForConfirmedField = (reply: string, fieldKey: FieldKey, setup: GuestSetup) => {
  const def = fieldDefByKey[fieldKey];
  const question = def.question(setup).toLowerCase();
  const label = def.label.toLowerCase();
  const normalized = reply.toLowerCase().trim();
  // Only suppress actual re-asks of the field question. A reply that merely mentions
  // the confirmed value (e.g. "Dine-in only it is...") must still be shown.
  return normalized.includes(question) || (normalized.includes(label) && normalized.endsWith('?'));
};

type Message = {
  id: number;
  from: 'q' | 'user';
  text: string;
};

type PublicConciergeResponse = {
  mode: 'ai' | 'guided';
  reply: string;
  updates?: Partial<GuestSetup>;
  suggestedReplies?: string[];
  recommendedModules?: string[];
  readyForSignIn?: boolean;
};

const statusText = (mode: 'ai' | 'guided' | 'pending') => {
  if (mode === 'ai') return 'Q is preparing a tailored plan';
  if (mode === 'guided') return 'Q is guiding your setup';
  return 'Q is preparing your workspace';
};

const moduleIcon = (moduleName: string) => {
  const key = moduleName.toLowerCase().replace(/[^a-z]/g, '');
  if (key.includes('dashboard')) return LayoutDashboard;
  if (key.includes('sales')) return TrendingUp;
  if (key.includes('kitchen') || key === 'kds') return ChefHat;
  if (key.includes('menu')) return BookOpen;
  if (key.includes('tables') || key === 'pos') return LayoutGrid;
  if (key.includes('stock')) return Package;
  if (key.includes('customers') || key.includes('team')) return Users;
  if (key.includes('reports')) return BarChart3;
  if (key.includes('finance')) return CircleDollarSign;
  if (key.includes('orders')) return ClipboardList;
  if (key.includes('bookings')) return Calendar;
  if (key.includes('settings')) return Settings;
  if (key.includes('qassistant') || key.includes('assistant')) return Sparkles;
  return Store;
};

const serviceModeIcon = (mode?: string) => {
  const normalized = (mode || '').toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'takeaway') return Truck;
  return Store;
};

const guestQStyles = [
  ':root{--q-bg:#ffffff;--q-surface:#fafafa;--q-text:#0a0a0a;--q-text-secondary:#5a6a7d;--q-border:#eeeeee;--q-border-strong:#e0e0e0;--q-accent:#e36b00;--q-accent-soft:#fff6ed;--q-q-bubble:#ffffff;--q-user-bubble:#0a0a0a;--q-success:#007b65;--q-error:#b0362c;--q-focus:#7cadff;}',
  '.guest-q-overlay{position:fixed;inset:0;z-index:2000;height:100dvh;display:grid;place-items:center;padding:24px;background:rgba(13,24,43,.55);backdrop-filter:blur(12px);overflow:hidden;overscroll-behavior:none;}',
  '.guest-q-modal{isolation:isolate;width:min(1180px,100%);height:min(860px,calc(100dvh - 48px));max-height:calc(100dvh - 48px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--q-border);border-radius:28px;background:var(--q-bg);color:var(--q-text);box-shadow:0 28px 90px rgba(15,30,55,.35);}',
  '.guest-q-overlay[data-theme=dark]{--q-bg:#0f1a2c;--q-surface:#121c2e;--q-text:#f5f8ff;--q-text-secondary:#90a0b8;--q-border:#273b58;--q-border-strong:#2b405f;--q-accent:#ff9a3c;--q-accent-soft:#3b2b20;--q-q-bubble:#17243a;--q-user-bubble:#1e2d46;}',
  '.guest-q-header{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:16px;padding:18px 26px;border-bottom:1px solid var(--q-border);}',
  '.guest-q-brand{display:flex;align-items:center;gap:12px;}',
  '.guest-q-brand-text{font-size:20px;font-weight:800;letter-spacing:-0.02em;}',
  '.guest-q-header-status{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--q-text-secondary);}',
  '.guest-q-status-dot{width:8px;height:8px;border-radius:50%;background:var(--q-accent);}',
  '.guest-q-close{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer;padding:8px;border-radius:10px;color:var(--q-text-secondary);}.guest-q-close:hover{background:var(--q-surface);color:var(--q-text);}',
  '.guest-q-content{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,0.9fr);flex:1 1 0;height:0;min-height:0;overflow:hidden;}',
  '.guest-q-chat{height:100%;max-height:100%;min-height:0;display:flex;flex-direction:column;padding:26px 28px 22px;gap:18px;overflow:hidden;}',
  '.guest-q-messages-wrap{position:relative;display:flex;flex:1 1 0;flex-direction:column;min-height:0;max-height:100%;}',
  '.guest-q-messages{display:flex;flex:1 1 0;flex-direction:column;gap:22px;min-height:0;max-height:100%;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-gutter:stable;padding-right:6px;}',
  '.guest-q-message{display:flex;gap:12px;max-width:88%;animation:guestQIn .2s ease-out both;}',
  '.guest-q-message--q{align-self:flex-start;}',
  '.guest-q-message--user{align-self:flex-end;flex-direction:row-reverse;}',
  '.guest-q-avatar{flex:0 0 36px;width:36px;height:36px;border-radius:12px;background:#0a0a0a;color:#fff;display:grid;place-items:center;overflow:hidden;}',
  '.guest-q-overlay[data-theme=dark] .guest-q-avatar{background:#1e2d46;}',
  '.guest-q-avatar svg{width:22px;height:22px;}',
  '.guest-q-bubble{padding:16px 18px;border:1px solid var(--q-border-strong);border-radius:18px;white-space:pre-wrap;line-height:1.55;font-size:16px;}',
  '.guest-q-bubble--q{background:var(--q-q-bubble);border-bottom-left-radius:5px;}',
  '.guest-q-bubble--user{background:var(--q-user-bubble);color:#fff;border-color:var(--q-user-bubble);border-bottom-right-radius:5px;}',
  '.guest-q-message-meta{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:var(--q-text-secondary);}',
  '.guest-q-message--user .guest-q-message-meta{justify-content:flex-end;}',
  '.guest-q-chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;}',
  '.guest-q-chip{border:1px solid var(--q-border-strong);border-radius:999px;background:var(--q-bg);color:var(--q-text);padding:10px 16px;font:inherit;font-size:15px;font-weight:500;cursor:pointer;animation:guestQIn .18s ease-out both;}.guest-q-chip:nth-child(2){animation-delay:.04s;}.guest-q-chip:nth-child(3){animation-delay:.08s;}.guest-q-chip:nth-child(4){animation-delay:.12s;}.guest-q-chip:nth-child(5){animation-delay:.16s;}.guest-q-chip:hover{border-color:var(--q-text);}.guest-q-chip:focus-visible{outline:2px solid var(--q-focus);outline-offset:2px;}',
  '.guest-q-jump{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:6px;border:1px solid var(--q-border-strong);border-radius:999px;background:var(--q-bg);color:var(--q-text);padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(15,30,55,.18);z-index:2;}.guest-q-jump:focus-visible{outline:2px solid var(--q-focus);outline-offset:2px;}',
  '.guest-q-actions{display:flex;flex-wrap:wrap;gap:10px;padding-top:2px;}',
  '.guest-q-action{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--q-border-strong);border-radius:999px;background:var(--q-bg);color:var(--q-text);padding:9px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;animation:guestQIn .18s ease-out both;}.guest-q-action:hover{border-color:var(--q-text);}.guest-q-action:disabled{opacity:.45;cursor:not-allowed;}.guest-q-action--primary{border-color:var(--q-text);background:var(--q-text);color:#fff;}.guest-q-action--primary:hover{background:#1a1a1a;border-color:#1a1a1a;color:#fff;}.guest-q-action:focus-visible{outline:2px solid var(--q-focus);outline-offset:2px;}',
  '.guest-q-typing{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;padding:12px 16px;border:1px solid var(--q-border-strong);border-radius:18px;border-bottom-left-radius:5px;background:var(--q-q-bubble);animation:guestQIn .18s ease-out both;}.guest-q-typing span{width:7px;height:7px;border-radius:50%;background:#8ba1bd;animation:guestQTyping 1.2s ease-in-out infinite;}.guest-q-typing span:nth-child(2){animation-delay:.15s;}.guest-q-typing span:nth-child(3){animation-delay:.3s;}',
  '@keyframes guestQIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}',
  '@keyframes guestQTyping{0%,60%,100%{transform:translateY(0);opacity:.45;}30%{transform:translateY(-4px);opacity:1;}}',
  '@media(prefers-reduced-motion:reduce){.guest-q-bubble,.guest-q-chip,.guest-q-action,.guest-q-typing,.guest-q-typing span,.guest-q-message{animation:none !important;}}',
  '.guest-q-form{position:relative;flex:0 0 auto;display:flex;align-items:flex-end;gap:12px;padding-top:6px;}',
  '.guest-q-input{min-width:0;flex:1;border:0;border-bottom:1px solid var(--q-border-strong);border-radius:0;background:transparent;color:var(--q-text);padding:16px 52px 16px 0;font:inherit;font-size:17px;line-height:1.45;}.guest-q-input:focus{outline:none;border-bottom-color:var(--q-accent);}.guest-q-input::placeholder{color:#9aa5b8;}',
  '.guest-q-send{position:absolute;right:0;bottom:4px;display:grid;place-items:center;width:48px;height:48px;border:0;border-radius:50%;background:var(--q-accent);color:#fff;cursor:pointer;transition:transform .1s ease,background .15s ease;}.guest-q-send:hover{background:#c75c00;}.guest-q-send:disabled{opacity:.45;cursor:not-allowed;}.guest-q-send:focus-visible{outline:2px solid var(--q-focus);outline-offset:2px;}',
  '.guest-q-input-note{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--q-text-secondary);margin-top:6px;}',
  '.guest-q-error{padding:12px 14px;border-radius:12px;background:#fff0ee;color:var(--q-error);font-size:14px;}',
  '.guest-q-brief{display:flex;flex-direction:column;gap:22px;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:28px;border-left:1px solid var(--q-border);background:var(--q-surface);}',
  '.guest-q-brief h3{margin:0;}',
  '.guest-q-plan-label{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--q-accent);margin-bottom:10px;}',
  '.guest-q-plan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}',
  '.guest-q-plan-title{font-size:34px;font-weight:700;letter-spacing:-0.03em;line-height:1.05;color:var(--q-text);word-break:break-word;}',
  '.guest-q-plan-subtitle{font-size:15px;color:var(--q-text-secondary);margin-top:5px;}',
  '.guest-q-plan-avatar{flex:0 0 52px;width:52px;height:52px;border-radius:50%;background:var(--q-accent-soft);color:var(--q-accent);display:grid;place-items:center;font-size:22px;font-weight:700;}',
  '.guest-q-plan-meta{display:flex;flex-wrap:wrap;gap:16px 22px;margin-top:6px;}',
  '.guest-q-meta-item{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--q-text);}',
  '.guest-q-meta-item svg{width:18px;height:18px;color:var(--q-accent);flex-shrink:0;}',
  '.guest-q-section-title{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--q-text-secondary);margin-bottom:10px;}',
  '.guest-q-draft{display:flex;flex-direction:column;gap:2px;}',
  '.guest-q-draft-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--q-border);font-size:14px;}',
  '.guest-q-draft-row:last-child{border-bottom:0;}',
  '.guest-q-draft-label{color:var(--q-text-secondary);}',
  '.guest-q-draft-value{font-weight:700;color:var(--q-text);text-align:right;}',
  '.guest-q-draft-missing{color:var(--q-accent);font-weight:700;text-align:right;}',
  '.guest-q-modules{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
  '.guest-q-module{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--q-bg);border:1px solid var(--q-border);font-size:14px;font-weight:600;color:var(--q-text);}',
  '.guest-q-module svg{width:17px;height:17px;color:var(--q-accent);flex-shrink:0;}',
  '.guest-q-brief-actions{display:flex;flex-direction:column;gap:10px;margin-top:auto;}.guest-q-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--q-border-strong);border-radius:14px;background:var(--q-bg);color:var(--q-text);padding:12px 14px;font:inherit;font-weight:700;cursor:pointer;}.guest-q-button:disabled{opacity:.45;cursor:not-allowed;}.guest-q-button--primary{border-color:var(--q-text);background:var(--q-text);color:#fff;padding:16px 18px;font-size:16px;}.guest-q-button--primary:hover{background:#1a1a1a;border-color:#1a1a1a;color:#fff;}.guest-q-button:focus-visible{outline:2px solid var(--q-focus);outline-offset:2px;}',
  '.guest-q-note{font-size:13px;color:var(--q-text-secondary);line-height:1.5;}',
  '@media(max-width:900px){.guest-q-overlay{padding:0;align-items:stretch;overflow:hidden;}.guest-q-modal{width:100%;height:100dvh;max-height:100dvh;border-radius:0;}.guest-q-content{display:flex;flex:1 1 0;flex-direction:column;height:0;min-height:0;overflow:hidden;grid-template-columns:none;}.guest-q-chat{flex:1 1 0;height:auto;max-height:none;min-height:0;overflow:hidden;padding:18px;}.guest-q-messages{flex:1 1 0;min-height:0;overflow-y:auto;padding-right:3px;}.guest-q-brief{flex:0 0 auto;max-height:36dvh;min-height:220px;overflow-y:auto;border-left:0;border-top:1px solid var(--q-border);padding:20px;}.guest-q-message{max-width:92%;}.guest-q-header{padding:14px 18px;}.guest-q-brand-text{font-size:18px;}.guest-q-plan-title{font-size:26px;}}',
].join('');

export function GuestQConcierge({
  initialPrompt,
  theme,
  onClose,
  onContinue,
}: {
  initialPrompt: string;
  theme: 'light' | 'dark';
  onClose: () => void;
  onContinue: (setup: GuestSetup, modules: string[]) => void;
}) {
  const firstSetup = useMemo(() => initialSetup(initialPrompt), [initialPrompt]);
  const [setup, setSetup] = useState(firstSetup);
  const [journey, setJourney] = useState<Record<FieldKey, FieldStatus>>(initialJourney());
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const [reviewReady, setReviewReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [recommendedModules, setRecommendedModules] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [replyMode, setReplyMode] = useState<'ai' | 'guided' | 'pending'>('pending');
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const messageId = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const setupRef = useRef(firstSetup);
  const journeyRef = useRef<Record<FieldKey, FieldStatus>>(initialJourney());
  const activeFieldRef = useRef<FieldKey | null>(null);
  const reviewReadyRef = useRef(false);
  const startedRef = useRef(false);
  const firstExchangeRef = useRef(true);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const pinnedRef = useRef(true);
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null) {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  useEffect(() => {
    reviewReadyRef.current = reviewReady;
  }, [reviewReady]);

  const setActiveFieldAndRef = useCallback((field: FieldKey | null) => {
    activeFieldRef.current = field;
    setActiveField(field);
  }, []);

  const setReviewReadyAndRef = useCallback((value: boolean) => {
    reviewReadyRef.current = value;
    setReviewReady(value);
  }, []);

  const appendMessage = useCallback((from: Message['from'], text: string) => {
    const next = [...messagesRef.current, { id: ++messageId.current, from, text }];
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const setQuickRepliesForField = useCallback((key: FieldKey | null) => {
    if (!key) {
      setQuickReplies([]);
      return;
    }
    const def = fieldDefByKey[key];
    const status = journeyRef.current[key];
    setQuickReplies(
      status === 'captured' ? ['Yes, that’s right', 'Change it'] : def.quickReplies(setupRef.current),
    );
  }, []);

  const askField = useCallback(
    (key: FieldKey) => {
      const def = fieldDefByKey[key];
      const status = journeyRef.current[key];
      const text =
        status === 'captured' ? def.confirmQuestion(setupRef.current) : def.question(setupRef.current);
      appendMessage('q', text);
      setActiveFieldAndRef(key);
      setQuickRepliesForField(key);
    },
    [appendMessage, setActiveFieldAndRef, setQuickRepliesForField],
  );

  const activateField = useCallback(
    (key: FieldKey) => {
      setActiveFieldAndRef(key);
      setQuickRepliesForField(key);
    },
    [setActiveFieldAndRef, setQuickRepliesForField],
  );

  const goToReview = useCallback(() => {
    if (reviewReadyRef.current) return;
    setReviewReadyAndRef(true);
    setActiveFieldAndRef(null);
    setQuickReplies([]);
    appendMessage(
      'q',
      'Your Q360 setup brief is ready. Review the recommended workspace, then continue securely to save it.',
    );
  }, [appendMessage, setActiveFieldAndRef, setReviewReadyAndRef]);

  const advance = useCallback(() => {
    if (reviewReadyRef.current) return;
    const next = nextField(setupRef.current, journeyRef.current);
    if (!next) {
      goToReview();
      return;
    }
    const lastMessage = messagesRef.current[messagesRef.current.length - 1];
    if (lastMessage?.from === 'q' && lastMessage.text.trim().endsWith('?')) {
      activateField(next);
      return;
    }
    askField(next);
  }, [askField, activateField, goToReview]);

  const markSkipped = useCallback((key: FieldKey) => {
    const next = { ...journeyRef.current, [key]: 'skipped' };
    journeyRef.current = next;
    setJourney(next);
  }, []);

  const finishOptional = useCallback(() => {
    const nextJourney = { ...journeyRef.current };
    for (const key of FIELD_ORDER) {
      const def = fieldDefByKey[key];
      if (!def.required(setupRef.current) && nextJourney[key] === 'missing') {
        nextJourney[key] = 'skipped';
      }
    }
    journeyRef.current = nextJourney;
    setJourney(nextJourney);
    goToReview();
  }, [goToReview]);

  const resetField = useCallback((key: FieldKey) => {
    const base = setupRef.current;
    const nextSetup: GuestSetup = { ...base, initialRequest: base.initialRequest };
    switch (key) {
      case 'businessType':
        nextSetup.businessType = '';
        nextSetup.serviceMode = '';
        nextSetup.services = [];
        break;
      case 'serviceMode':
        nextSetup.serviceMode = '';
        nextSetup.services = [];
        break;
      case 'businessName':
        nextSetup.businessName = '';
        break;
      case 'country':
        nextSetup.country = '';
        break;
      case 'email':
        nextSetup.email = '';
        break;
      case 'tables':
        delete nextSetup.tables;
        break;
      case 'teamSize':
        delete nextSetup.employees;
        break;
      case 'stockConcerns':
        delete nextSetup.stockConcerns;
        break;
      case 'bookings':
        delete nextSetup.bookings;
        break;
      case 'priorities':
        nextSetup.priorities = [];
        break;
      case 'otherPreferences':
        delete nextSetup.otherPreferences;
        break;
    }
    setupRef.current = nextSetup;
    setSetup(nextSetup);
    const nextJourney = { ...journeyRef.current, [key]: 'missing' };
    journeyRef.current = nextJourney;
    setJourney(nextJourney);
  }, []);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim().slice(0, 1200);
      if (!message || isSending) return;

      const activeKey = activeFieldRef.current;
      const activeStatus = activeKey ? journeyRef.current[activeKey] : null;

      // Handle confirmation of a captured field.
      if (activeKey && activeStatus === 'captured') {
        const def = fieldDefByKey[activeKey];
        if (isSkipMessage(message) && !def.required(setupRef.current)) {
          appendMessage('user', message);
          markSkipped(activeKey);
          advance();
          setInput('');
          return;
        }
        if (isSkipMessage(message) && def.required(setupRef.current)) {
          appendMessage('user', message);
          appendMessage('q', `I need your ${def.label} to prepare the workspace.`);
          setInput('');
          return;
        }
        if (isConfirmMessage(message) || isContinueMessage(message)) {
          appendMessage('user', message);
          const nextJourney = { ...journeyRef.current, [activeKey]: 'confirmed' };
          journeyRef.current = nextJourney;
          setJourney(nextJourney);
          advance();
          setInput('');
          return;
        }
        if (isChangeMessage(message)) {
          appendMessage('user', message);
          resetField(activeKey);
          advance();
          setInput('');
          return;
        }
      }

      const skip = isSkipMessage(message);
      const cont = isContinueMessage(message);

      if (skip) {
        appendMessage('user', message);
        if (activeKey && !fieldDefByKey[activeKey].required(setupRef.current)) {
          markSkipped(activeKey);
          advance();
        } else if (activeKey) {
          appendMessage('q', `I need your ${fieldDefByKey[activeKey].label} to prepare the workspace.`);
        } else if (requiredComplete(setupRef.current, journeyRef.current)) {
          goToReview();
        } else {
          appendMessage('q', 'Tell me a bit more, or choose one of the options above.');
        }
        setInput('');
        return;
      }

      if (cont) {
        appendMessage('user', message);
        if (requiredComplete(setupRef.current, journeyRef.current)) {
          goToReview();
        } else {
          const missing = requiredFields(setupRef.current)
            .filter((key) => !fieldDefByKey[key].hasValue(setupRef.current))
            .map((key) => fieldDefByKey[key].label.toLowerCase());
          appendMessage(
            'q',
            `I still need a few required details before we can continue: ${missing.join(', ')}.`,
          );
        }
        setInput('');
        return;
      }

      const pendingField = activeKey;
      appendMessage('user', message);
      setInput('');
      setQuickReplies([]);
      setError('');
      setIsSending(true);

      // A personal-name statement while we are asking for the business name must not
      // be stored as the business name. Ask for clarification instead of inferring.
      if (pendingField === 'businessName' && isOwnerNameStatement(message)) {
        const ownerName = ownerNameFromStatement(message);
        appendMessage(
          'q',
          ownerName
            ? `Is ${ownerName} your business name, or your personal name?`
            : 'Is that your business name, or your personal name?',
        );
        setIsSending(false);
        return;
      }

      // Direct answers to the currently active field (e.g. quick replies) should be
      // written into setup and confirmed immediately so the next question is never
      // the same field again.
      const activeFieldAnswer = parseActiveAnswer(message, pendingField, setupRef.current);
      const activeAnswerValue = pendingField
        ? (activeFieldAnswer as Record<string, unknown>)[pendingField]
        : undefined;
      const hasActiveAnswer =
        pendingField &&
        activeAnswerValue !== undefined &&
        activeAnswerValue !== '' &&
        activeAnswerValue !== null;
      if (hasActiveAnswer) {
        const preSetup = mergeSetup(setupRef.current, activeFieldAnswer);
        setupRef.current = preSetup;
        setSetup(preSetup);
        const preJourney = { ...journeyRef.current, [pendingField]: 'confirmed' };
        journeyRef.current = preJourney;
        setJourney(preJourney);
      }

      try {
        const result = await http.post<PublicConciergeResponse>(
          '/public/q-concierge',
          {
            message,
            history: messagesRef.current.slice(-10).map((item) => ({
              role: item.from === 'user' ? 'user' : 'assistant',
              content: item.text,
            })),
            draft: setupRef.current,
          },
          { timeout: 45_000 },
        );
        let nextSetup = mergeSetup(setupRef.current, result.updates);
        const localUpdates = parseActiveAnswer(message, pendingField, nextSetup);
        nextSetup = mergeSetup(nextSetup, localUpdates);
        setupRef.current = nextSetup;
        setSetup(nextSetup);

        const markVolunteeredConfirmed = firstExchangeRef.current;
        firstExchangeRef.current = false;
        const nextJourney = syncJourney(nextSetup, journeyRef.current, pendingField, false, markVolunteeredConfirmed);
        journeyRef.current = nextJourney;
        setJourney(nextJourney);

        setRecommendedModules(listOf(result.recommendedModules, 12));
        setReplyMode(result.mode);

        const backendReply = textOf(result.reply, 2400);
        const isRepeatedQuestion =
          backendReply &&
          pendingField &&
          journeyRef.current[pendingField] === 'confirmed' &&
          isQuestionForConfirmedField(backendReply, pendingField, setupRef.current);

        if (backendReply && !isRepeatedQuestion) {
          appendMessage('q', backendReply);
        }

        advance();
      } catch {
        setError('Q is temporarily unavailable. Please try again in a moment.');
      } finally {
        setIsSending(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [appendMessage, isSending, advance, goToReview, markSkipped, resetField],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void sendMessage(initialPrompt.trim() || 'Hello');
  }, [initialPrompt, sendMessage]);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = messageScrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (pinnedRef.current) {
        scrollToLatest();
        setHasNewBelow(false);
      } else {
        setHasNewBelow(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, isSending, quickReplies, scrollToLatest]);

  const handleMessagesScroll = useCallback(() => {
    const container = messageScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const pinned = distanceFromBottom < 80;
    pinnedRef.current = pinned;
    if (pinned) setHasNewBelow(false);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      openerRef.current?.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const root = modalRef.current;
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const focusIsInside = active instanceof HTMLElement && root.contains(active);
    if (event.shiftKey) {
      if (!focusIsInside || active === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (!focusIsInside || active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const progress = requiredProgress(setup, journey);
  const canContinue = requiredComplete(setup, journey);
  const modules = recommendedModules.length ? recommendedModules : fallbackModules(setup);

  const missingRequired = requiredFields(setup).filter(
    (key) => journey[key] === 'missing' || !fieldDefByKey[key].hasValue(setup),
  );
  const optionalRemaining = FIELD_ORDER.filter(
    (key) =>
      !fieldDefByKey[key].required(setup) &&
      fieldDefByKey[key].applicable(setup) &&
      journey[key] === 'missing',
  );

  const continueHint = !emailPattern.test(setup.email)
    ? 'Share your email in the chat to unlock secure sign-in.'
    : missingRequired.length
      ? `Still needed: ${missingRequired.map((key) => fieldDefByKey[key].label).join(', ')}.`
      : 'Q is still preparing your setup.';

  const activeDef = activeField ? fieldDefByKey[activeField] : null;
  const showNext = activeField ? journey[activeField] === 'captured' : false;
  const showSkip = activeField
    ? !activeDef?.required(setup) &&
      journey[activeField] !== 'skipped' &&
      journey[activeField] !== 'confirmed'
    : false;
  const showDefaults = canContinue && !reviewReady;

  const handleNext = useCallback(() => {
    if (!activeFieldRef.current) return;
    const key = activeFieldRef.current;
    if (journeyRef.current[key] === 'captured') {
      const nextJourney = { ...journeyRef.current, [key]: 'confirmed' };
      journeyRef.current = nextJourney;
      setJourney(nextJourney);
      advance();
    }
  }, [advance]);

  const handleSkip = useCallback(() => {
    if (!activeFieldRef.current) return;
    const key = activeFieldRef.current;
    if (!fieldDefByKey[key].required(setupRef.current)) {
      markSkipped(key);
      advance();
    }
  }, [advance, markSkipped]);

  const handleUseDefaults = useCallback(() => {
    finishOptional();
    const modules = recommendedModules.length ? recommendedModules : fallbackModules(setupRef.current);
    onContinue(setupRef.current, modules);
  }, [finishOptional, onContinue, recommendedModules]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const copyBrief = async () => {
    const brief = [
      'Q360 setup brief',
      `Business: ${setup.businessName || '(not set)'}`,
      `Type: ${setup.businessType || '(not set)'}`,
      setup.serviceMode ? `Service mode: ${formatFieldValue('serviceMode', setup)}` : '',
      `Country: ${setup.country || '(not set)'}`,
      setup.tables !== undefined ? `Tables: ${setup.tables}` : '',
      setup.employees !== undefined ? `Team: ${setup.employees}` : '',
      setup.priorities.length ? `Priorities: ${setup.priorities.join(', ')}` : '',
      setup.stockConcerns ? 'Stock: track inventory' : '',
      setup.bookings ? 'Bookings: enabled' : '',
      setup.otherPreferences ? `Other: ${setup.otherPreferences}` : '',
      `Recommended modules: ${modules.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Your browser could not copy the brief. You can select and copy it manually.');
    }
  };

  const confirmedRows = FIELD_ORDER.filter((key) => {
    const def = fieldDefByKey[key];
    return def.applicable(setup) && fieldDefByKey[key].hasValue(setup);
  });

  const workspaceTypeLabel = setup.businessType
    ? `${setup.businessType[0].toUpperCase()}${setup.businessType.slice(1)} workspace`
    : 'Workspace plan';

  const initialAvatar = setup.businessName.trim().slice(0, 1).toUpperCase() || '?';
  const derivedCurrency = setup.country ? currencyForCountry(setup.country) : '';

  return (
    <div
      className={'guest-q-overlay guest-q-overlay--' + theme}
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label="Q Concierge"
      onKeyDown={handleKeyDown}
    >
      <style>{guestQStyles}</style>
      <section className="guest-q-modal" ref={modalRef}>
        <header className="guest-q-header">
          <div className="guest-q-brand">
            <LogoMark size={44} />
            <span className="guest-q-brand-text">Q360</span>
          </div>
          <div className={'guest-q-header-status ' + (replyMode === 'ai' ? 'guest-q-status--ai' : '')}>
            <span className="guest-q-status-dot" aria-hidden="true" />
            {statusText(replyMode)}
          </div>
          <button className="guest-q-close" type="button" onClick={onClose} aria-label="Close Q Concierge">
            <X size={24} />
          </button>
        </header>

        <div className="guest-q-content">
          <div className="guest-q-chat">
            <div className="guest-q-messages-wrap">
              <div
                className="guest-q-messages"
                ref={messageScrollRef}
                onScroll={handleMessagesScroll}
                role="log"
                aria-live="polite"
                aria-busy={isSending}
              >
                {messages.map((item) => (
                  <div key={item.id} className={'guest-q-message guest-q-message--' + item.from}>
                    {item.from === 'q' ? (
                      <div className="guest-q-avatar" aria-hidden="true">
                        <LogoMark size={22} />
                      </div>
                    ) : null}
                    <div>
                      <div className={'guest-q-bubble guest-q-bubble--' + item.from}>{item.text}</div>
                      {item.from === 'user' ? (
                        <div className="guest-q-message-meta">
                          <Check size={12} />
                          Sent
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {isSending ? (
                  <div className="guest-q-message guest-q-message--q">
                    <div className="guest-q-avatar" aria-hidden="true">
                      <LogoMark size={22} />
                    </div>
                    <div className="guest-q-typing" role="status" aria-label="Q is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ) : null}
                {!isSending && quickReplies.length ? (
                  <div className="guest-q-message guest-q-message--q">
                    <div className="guest-q-avatar" aria-hidden="true">
                      <LogoMark size={22} />
                    </div>
                    <div className="guest-q-chips">
                      {quickReplies.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          className="guest-q-chip"
                          onClick={() => void sendMessage(reply)}
                          disabled={isSending}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              {hasNewBelow ? (
                <button
                  type="button"
                  className="guest-q-jump"
                  onClick={() => {
                    pinnedRef.current = true;
                    setHasNewBelow(false);
                    scrollToLatest('smooth');
                  }}
                >
                  <ArrowDown size={15} />
                  New message
                </button>
              ) : null}
            </div>

            {!reviewReady && (showNext || showSkip || showDefaults) ? (
              <div className="guest-q-actions" role="toolbar" aria-label="Setup actions">
                {showNext ? (
                  <button
                    type="button"
                    className="guest-q-action guest-q-action--primary"
                    onClick={handleNext}
                    disabled={isSending}
                  >
                    Next
                  </button>
                ) : null}
                {showSkip ? (
                  <button type="button" className="guest-q-action" onClick={handleSkip} disabled={isSending}>
                    Skip for now
                  </button>
                ) : null}
                {showDefaults ? (
                  <button
                    type="button"
                    className="guest-q-action guest-q-action--primary"
                    onClick={handleUseDefaults}
                    disabled={isSending}
                  >
                    Use defaults and continue
                  </button>
                ) : null}
              </div>
            ) : null}

            {error ? <div className="guest-q-error">{error}</div> : null}

            <form className="guest-q-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="guest-q-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Tell Q about your business..."
                aria-label="Message Q"
              />
              <button
                className="guest-q-send"
                type="submit"
                disabled={!input.trim() || isSending}
                aria-label="Send message"
              >
                <Send size={20} />
              </button>
            </form>
            <div className="guest-q-input-note">
              <Lock size={14} />
              Prepared by Q. Approved by you. Nothing happens without you.
            </div>
          </div>

          <aside className="guest-q-brief" aria-label="Workspace plan">
            <div>
              <div className="guest-q-plan-label">Your plan</div>
              <div className="guest-q-plan-head">
                <div>
                  <h3 className="guest-q-plan-title">{setup.businessName || 'Your workspace'}</h3>
                  <div className="guest-q-plan-subtitle">{workspaceTypeLabel}</div>
                </div>
                <div className="guest-q-plan-avatar" aria-hidden="true">
                  {initialAvatar}
                </div>
              </div>

              <div className="guest-q-plan-meta">
                {setup.country ? (
                  <div className="guest-q-meta-item">
                    <MapPin />
                    {setup.country}
                  </div>
                ) : null}
                {derivedCurrency ? (
                  <div className="guest-q-meta-item">
                    <CircleDollarSign />
                    {derivedCurrency}
                  </div>
                ) : null}
                {setup.tables !== undefined ? (
                  <div className="guest-q-meta-item">
                    <LayoutGrid />
                    {setup.tables} tables
                  </div>
                ) : null}
                {setup.serviceMode ? (
                  <div className="guest-q-meta-item">
                    {(() => {
                      const Icon = serviceModeIcon(setup.serviceMode);
                      return <Icon />;
                    })()}
                    {formatFieldValue('serviceMode', setup)}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <div className="guest-q-section-title">Prepared modules</div>
              <div className="guest-q-modules">
                {modules.map((module) => {
                  const Icon = moduleIcon(module);
                  return (
                    <div key={module} className="guest-q-module">
                      <Icon />
                      {module}
                    </div>
                  );
                })}
              </div>
            </div>

            {confirmedRows.length > 0 ? (
              <div>
                <div className="guest-q-section-title">
                  {reviewReady ? 'Confirmed' : 'Your workspace draft'}
                </div>
                <div className="guest-q-draft">
                  {confirmedRows.map((key) => {
                    const def = fieldDefByKey[key];
                    const value = formatFieldValue(key, setup);
                    return (
                      <div key={key} className="guest-q-draft-row">
                        <span className="guest-q-draft-label">{def.label}</span>
                        <span className="guest-q-draft-value">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="guest-q-section-title">Your workspace draft</div>
                <p className="guest-q-note">
                  {progress.done} of {progress.total} required details collected. Q will recommend modules as the setup takes shape.
                </p>
              </div>
            )}

            {missingRequired.length > 0 || optionalRemaining.length > 0 ? (
              <div>
                <div className="guest-q-section-title">Still needed</div>
                <div className="guest-q-draft">
                  {missingRequired.map((key) => (
                    <div key={key} className="guest-q-draft-row">
                      <span className="guest-q-draft-label">{fieldDefByKey[key].label}</span>
                      <span className="guest-q-draft-missing">Required</span>
                    </div>
                  ))}
                  {optionalRemaining.map((key) => (
                    <div key={key} className="guest-q-draft-row">
                      <span className="guest-q-draft-label">{fieldDefByKey[key].label}</span>
                      <span className="guest-q-draft-missing">Optional</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="guest-q-brief-actions">
              <button type="button" className="guest-q-button" onClick={() => void copyBrief()}>
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copied' : 'Copy brief'}
              </button>
              <button
                type="button"
                className="guest-q-button guest-q-button--primary"
                onClick={() => onContinue(setup, modules)}
                disabled={!canContinue}
              >
                {reviewReady ? 'Review and continue securely' : 'Continue securely'}
                <ArrowRight size={17} />
              </button>
            </div>
            {!canContinue ? <div className="guest-q-note">{continueHint}</div> : null}
            <div className="guest-q-note">
              Q does not need your password or payment details. You remain in control of every decision.
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
