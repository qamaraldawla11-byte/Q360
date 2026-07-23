import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, Copy, Send, Sparkles, X } from 'lucide-react';
import { http } from '@/api/http';
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
  isSkipMessage,
  listOf,
  mergeSetup,
  nextField,
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
  const confirmQuestion = def.confirmQuestion(setup).toLowerCase();
  const label = def.label.toLowerCase();
  const normalized = reply.toLowerCase();
  return (
    normalized.includes(question) ||
    normalized.includes(confirmQuestion) ||
    normalized.includes(label)
  );
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

const guestQStyles = [
  '.guest-q-overlay{position:fixed;inset:0;z-index:2000;height:100dvh;display:grid;place-items:center;padding:24px;background:rgba(13,24,43,.55);backdrop-filter:blur(12px);overflow:hidden;overscroll-behavior:none;}',
  '.guest-q-modal{isolation:isolate;width:min(1120px,100%);height:min(820px,calc(100dvh - 48px));max-height:calc(100dvh - 48px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #d9e2ef;border-radius:28px;background:#fffdf9;color:#14233b;box-shadow:0 28px 90px rgba(15,30,55,.35);}',
  '.guest-q-overlay[data-theme=dark] .guest-q-modal{background:#0f1a2c;color:#edf5ff;border-color:#2b405f;}',
  '.guest-q-header{display:flex;flex:0 0 auto;align-items:center;gap:14px;padding:20px 26px;border-bottom:1px solid #e3e9f2;}',
  '.guest-q-overlay[data-theme=dark] .guest-q-header{border-color:#273b58;}',
  '.guest-q-title{font-size:22px;font-weight:800;line-height:1.1;}.guest-q-subtitle{margin-top:4px;color:#627695;font-size:15px;}',
  '.guest-q-close{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer;padding:8px;border-radius:10px;}.guest-q-close:hover{background:#eef3fa;}',
  '.guest-q-content{display:grid;grid-template-columns:minmax(0,1fr) 320px;flex:1 1 0;height:0;min-height:0;overflow:hidden;}',
  '.guest-q-chat{height:100%;max-height:100%;min-height:0;display:flex;flex-direction:column;padding:24px;gap:14px;overflow:hidden;}.guest-q-messages-wrap{position:relative;display:flex;flex:1 1 0;flex-direction:column;min-height:0;max-height:100%;}.guest-q-messages{display:flex;flex:1 1 0;flex-direction:column;gap:16px;min-height:0;max-height:100%;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-gutter:stable;padding-right:6px;}',
  '.guest-q-bubble{max-width:78%;padding:16px 18px;border:1px solid #dce5f0;border-radius:18px;white-space:pre-wrap;line-height:1.55;font-size:17px;animation:guestQIn .18s ease-out both;}.guest-q-bubble--q{align-self:flex-start;background:#fff;border-bottom-left-radius:5px;}.guest-q-bubble--user{align-self:flex-end;background:#131e32;color:#fff;border-color:#131e32;border-bottom-right-radius:5px;}',
  '.guest-q-overlay[data-theme=dark] .guest-q-bubble--q{background:#17243a;border-color:#2a405e;color:#f5f8ff;}',
  '.guest-q-status{display:inline-flex;align-items:center;gap:7px;width:max-content;margin-left:2px;color:#567093;font-size:13px;font-weight:700;}.guest-q-status--ai{color:#007b65;}',
  '.guest-q-progress{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#556b8a;}',
  '.guest-q-progress-row{display:flex;align-items:center;gap:10px;}',
  '.guest-q-progress-bar{flex:1;height:6px;border-radius:999px;background:#e3e9f2;overflow:hidden;}',
  '.guest-q-progress-bar span{display:block;height:100%;background:#007b65;transition:width .2s ease;}',
  '.guest-q-error{padding:11px 14px;border-radius:12px;background:#fff0ee;color:#b0362c;font-size:14px;}.guest-q-chips{display:flex;flex-wrap:wrap;gap:9px;}.guest-q-chip{border:1px solid #cad8ea;border-radius:999px;background:#fff;color:#27405f;padding:9px 13px;font:inherit;cursor:pointer;animation:guestQIn .18s ease-out both;}.guest-q-chip:nth-child(2){animation-delay:.04s;}.guest-q-chip:nth-child(3){animation-delay:.08s;}.guest-q-chip:nth-child(4){animation-delay:.12s;}.guest-q-chip:nth-child(5){animation-delay:.16s;}.guest-q-chip:hover{border-color:#2f7df6;color:#1263d9;}.guest-q-jump{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:6px;border:1px solid #c7d5e7;border-radius:999px;background:#ffffff;color:#1b2b43;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(15,30,55,.18);z-index:2;}.guest-q-overlay[data-theme=dark] .guest-q-jump{background:#17243a;border-color:#2a405e;color:#f5f8ff;}.guest-q-chip:focus-visible,.guest-q-button:focus-visible,.guest-q-jump:focus-visible,.guest-q-send:focus-visible,.guest-q-close:focus-visible,.guest-q-action:focus-visible{outline:2px solid #7cadff;outline-offset:2px;}',
  '.guest-q-actions{display:flex;flex-wrap:wrap;gap:10px;padding-top:2px;}',
  '.guest-q-action{display:inline-flex;align-items:center;gap:6px;border:1px solid #cad8ea;border-radius:999px;background:#fff;color:#27405f;padding:9px 14px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;animation:guestQIn .18s ease-out both;}',
  '.guest-q-action:hover{border-color:#2f7df6;color:#1263d9;}',
  '.guest-q-action:disabled{opacity:.45;cursor:not-allowed;}',
  '.guest-q-action--primary{border-color:#11223b;background:#11223b;color:#fff;}',
  '.guest-q-action--primary:hover{background:#1a304d;border-color:#1a304d;color:#fff;}',
  '.guest-q-typing{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;padding:12px 16px;border:1px solid #dce5f0;border-radius:18px;border-bottom-left-radius:5px;background:#fff;animation:guestQIn .18s ease-out both;}.guest-q-overlay[data-theme=dark] .guest-q-typing{background:#17243a;border-color:#2a405e;}.guest-q-typing span{width:7px;height:7px;border-radius:50%;background:#8ba1bd;animation:guestQTyping 1.2s ease-in-out infinite;}.guest-q-typing span:nth-child(2){animation-delay:.15s;}.guest-q-typing span:nth-child(3){animation-delay:.3s;}',
  '@keyframes guestQIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}',
  '@keyframes guestQTyping{0%,60%,100%{transform:translateY(0);opacity:.45;}30%{transform:translateY(-4px);opacity:1;}}',
  '@media(prefers-reduced-motion:reduce){.guest-q-bubble,.guest-q-chip,.guest-q-action,.guest-q-typing,.guest-q-typing span{animation:none !important;}}',
  '.guest-q-form{display:flex;flex:0 0 auto;gap:10px;padding-top:6px;}.guest-q-input{min-width:0;flex:1;border:1px solid #c7d5e7;border-radius:15px;background:#fff;color:#18263a;padding:14px 16px;font:inherit;font-size:16px;}.guest-q-input:focus{outline:2px solid #7cadff;outline-offset:1px;}.guest-q-send{display:grid;place-items:center;width:54px;border:0;border-radius:15px;background:#14223a;color:#fff;cursor:pointer;}.guest-q-send:disabled{opacity:.45;cursor:not-allowed;}',
  '.guest-q-brief{display:flex;flex-direction:column;gap:14px;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:24px;border-left:1px solid #e3e9f2;background:#fbfcff;}.guest-q-overlay[data-theme=dark] .guest-q-brief{background:#101c2e;border-color:#273b58;}.guest-q-brief h3{margin:0;font-size:19px;}.guest-q-brief p{margin:0;color:#637898;line-height:1.55;font-size:14px;}.guest-q-modules{display:flex;flex-wrap:wrap;gap:7px;}.guest-q-modules span{padding:7px 9px;border-radius:999px;background:#fff2e4;color:#b85200;font-size:13px;font-weight:700;}.guest-q-overlay[data-theme=dark] .guest-q-modules span{background:#3b2b20;color:#ffbd7b;}',
  '.guest-q-draft{display:flex;flex-direction:column;gap:2px;}',
  '.guest-q-draft-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #e8edf5;font-size:14px;}',
  '.guest-q-draft-row:last-child{border-bottom:0;}',
  '.guest-q-draft-label{color:#637898;}',
  '.guest-q-draft-value{font-weight:700;color:#14233b;text-align:right;}',
  '.guest-q-overlay[data-theme=dark] .guest-q-draft-value{color:#edf5ff;}',
  '.guest-q-draft-missing{color:#b85200;font-weight:700;text-align:right;}',
  '.guest-q-draft-section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#8ba1bd;margin-top:6px;}',
  '.guest-q-brief-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:auto;}.guest-q-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #c7d5e7;border-radius:12px;background:#fff;color:#1b2b43;padding:11px 13px;font:inherit;font-weight:750;cursor:pointer;}.guest-q-button:disabled{opacity:.45;cursor:not-allowed;}.guest-q-button--primary{border-color:#11223b;background:#11223b;color:#fff;}.guest-q-note{font-size:13px;color:#71809a;}',
  '@media(max-width:760px){.guest-q-overlay{padding:0;align-items:stretch;overflow:hidden;}.guest-q-modal{width:100%;height:100dvh;max-height:100dvh;border-radius:0;}.guest-q-content{display:flex;flex:1 1 0;flex-direction:column;height:0;min-height:0;overflow:hidden;}.guest-q-chat{flex:1 1 0;height:auto;max-height:none;min-height:0;overflow:hidden;padding:18px;}.guest-q-messages{flex:1 1 0;min-height:0;overflow-y:auto;padding-right:3px;}.guest-q-brief{flex:0 0 auto;max-height:34dvh;overflow-y:auto;border-left:0;border-top:1px solid #e3e9f2;}.guest-q-bubble{max-width:92%;}.guest-q-header{padding:16px 18px;}}',
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
          <LogoMark size={50} />
          <div>
            <div className="guest-q-title">Q Concierge</div>
            <div className="guest-q-subtitle">Plan your workspace before sign-in</div>
          </div>
          <button className="guest-q-close" type="button" onClick={onClose} aria-label="Close Q Concierge">
            <X size={25} />
          </button>
        </header>

        <div className="guest-q-content">
          <div className="guest-q-chat">
            <div className={'guest-q-status ' + (replyMode === 'ai' ? 'guest-q-status--ai' : '')}>
              <Sparkles size={15} />
              {replyMode === 'ai'
                ? 'Q is preparing a tailored plan'
                : replyMode === 'guided'
                  ? 'Q is guiding your setup'
                  : 'Q is ready to help'}
            </div>

            <div className="guest-q-progress">
              <div className="guest-q-progress-row">
                <span>
                  {progress.done} of {progress.total} required details collected
                </span>
                <div className="guest-q-progress-bar">
                  <span
                    style={{
                      width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>
            </div>

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
                  <div key={item.id} className={'guest-q-bubble guest-q-bubble--' + item.from}>
                    {item.text}
                  </div>
                ))}
                {isSending ? (
                  <div className="guest-q-typing" role="status" aria-label="Q is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : null}
                {!isSending && quickReplies.length ? (
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
                placeholder="Reply to Q..."
                aria-label="Message Q"
              />
              <button
                className="guest-q-send"
                type="submit"
                disabled={!input.trim() || isSending}
                aria-label="Send message"
              >
                <Send size={21} />
              </button>
            </form>
          </div>

          <aside className="guest-q-brief">
            <div>
              <h3>{reviewReady ? 'Your setup brief is ready' : 'Your workspace draft'}</h3>
              <p>
                {reviewReady
                  ? 'Review this recommended setup, then sign in securely to save it.'
                  : `${progress.done} of ${progress.total} required details collected. Q will recommend modules as the setup takes shape.`}
              </p>
            </div>

            <div className="guest-q-draft">
              {FIELD_ORDER.map((key) => {
                const def = fieldDefByKey[key];
                if (!def.applicable(setup)) return null;
                const value = formatFieldValue(key, setup);
                const missing = !value;
                return (
                  <div key={key} className="guest-q-draft-row">
                    <span className="guest-q-draft-label">{def.label}</span>
                    <span className={missing ? 'guest-q-draft-missing' : 'guest-q-draft-value'}>
                      {missing
                        ? def.required(setup)
                          ? 'Required'
                          : 'Not completed'
                        : value}
                    </span>
                  </div>
                );
              })}
            </div>

            {missingRequired.length > 0 ? (
              <div>
                <div className="guest-q-draft-section-title">Missing required</div>
                <p>{missingRequired.map((key) => fieldDefByKey[key].label).join(', ')}</p>
              </div>
            ) : null}

            {optionalRemaining.length > 0 ? (
              <div>
                <div className="guest-q-draft-section-title">Optional not completed</div>
                <p>{optionalRemaining.map((key) => fieldDefByKey[key].label).join(', ')}</p>
              </div>
            ) : null}

            <div>
              <div className="guest-q-draft-section-title">Recommended modules</div>
              <div className="guest-q-modules">
                {modules.map((module) => (
                  <span key={module}>{module}</span>
                ))}
              </div>
            </div>

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
                Continue securely <ArrowRight size={17} />
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
