import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, Copy, Send, Sparkles, X } from 'lucide-react';
import { http } from '@/api/http';
import { LogoMark } from '@/components/ui/Logo';

export interface GuestSetup {
  initialRequest: string;
  businessType: string;
  businessName: string;
  country: string;
  services: string[];
  tables?: number;
  employees?: number;
  priorities: string[];
  email: string;
}

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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const textOf = (value: unknown, maxLength = 140) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const listOf = (value: unknown, maxLength = 8) =>
  Array.isArray(value)
    ? value
        .map((item) => textOf(item, 80))
        .filter(Boolean)
        .slice(0, maxLength)
    : [];

const countOf = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : undefined;
};

const initialSetup = (initialRequest: string): GuestSetup => ({
  initialRequest,
  businessType: '',
  businessName: '',
  country: '',
  services: [],
  priorities: [],
  email: '',
});

const mergeSetup = (current: GuestSetup, updates?: Partial<GuestSetup>): GuestSetup => {
  if (!updates) return current;
  const nextServices = listOf(updates.services);
  const nextPriorities = listOf(updates.priorities);

  return {
    ...current,
    businessType: textOf(updates.businessType) || current.businessType,
    businessName: textOf(updates.businessName) || current.businessName,
    country: textOf(updates.country) || current.country,
    email: textOf(updates.email) || current.email,
    services: nextServices.length ? nextServices : current.services,
    priorities: nextPriorities.length ? nextPriorities : current.priorities,
    tables: countOf(updates.tables) ?? current.tables,
    employees: countOf(updates.employees) ?? current.employees,
  };
};

const fallbackModules = (setup: GuestSetup) => {
  const modules = ['Dashboard', 'Q Assistant'];
  const type = setup.businessType.toLowerCase();
  if (type.includes('restaurant') || type.includes('cafe')) {
    modules.push('Sales', 'Kitchen', 'Menu', 'Tables', 'Stock', 'Orders', 'Finance', 'Customers');
  } else {
    modules.push('Sales', 'Customers', 'Finance');
  }
  return modules;
};

const guestQStyles = [
  '.guest-q-overlay{position:fixed;inset:0;z-index:2000;height:100dvh;display:grid;place-items:center;padding:24px;background:rgba(13,24,43,.55);backdrop-filter:blur(12px);overflow:hidden;overscroll-behavior:none;}',
  '.guest-q-modal{isolation:isolate;width:min(1120px,100%);height:min(820px,calc(100dvh - 48px));max-height:calc(100dvh - 48px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #d9e2ef;border-radius:28px;background:#fffdf9;color:#14233b;box-shadow:0 28px 90px rgba(15,30,55,.35);}',
  '.guest-q-overlay[data-theme=dark] .guest-q-modal{background:#0f1a2c;color:#edf5ff;border-color:#2b405f;}',
  '.guest-q-header{display:flex;flex:0 0 auto;align-items:center;gap:14px;padding:20px 26px;border-bottom:1px solid #e3e9f2;}',
  '.guest-q-overlay[data-theme=dark] .guest-q-header{border-color:#273b58;}',
  '.guest-q-title{font-size:22px;font-weight:800;line-height:1.1;}.guest-q-subtitle{margin-top:4px;color:#627695;font-size:15px;}',
  '.guest-q-close{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer;padding:8px;border-radius:10px;}.guest-q-close:hover{background:#eef3fa;}',
  '.guest-q-content{display:grid;grid-template-columns:minmax(0,1fr) 310px;flex:1 1 0;height:0;min-height:0;overflow:hidden;}',
  '.guest-q-chat{height:100%;max-height:100%;min-height:0;display:flex;flex-direction:column;padding:24px;gap:16px;overflow:hidden;}.guest-q-messages-wrap{position:relative;display:flex;flex:1 1 0;flex-direction:column;min-height:0;max-height:100%;}.guest-q-messages{display:flex;flex:1 1 0;flex-direction:column;gap:16px;min-height:0;max-height:100%;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-gutter:stable;padding-right:6px;}',
  '.guest-q-bubble{max-width:78%;padding:16px 18px;border:1px solid #dce5f0;border-radius:18px;white-space:pre-wrap;line-height:1.55;font-size:17px;animation:guestQIn .18s ease-out both;}.guest-q-bubble--q{align-self:flex-start;background:#fff;border-bottom-left-radius:5px;}.guest-q-bubble--user{align-self:flex-end;background:#131e32;color:#fff;border-color:#131e32;border-bottom-right-radius:5px;}',
  '.guest-q-overlay[data-theme=dark] .guest-q-bubble--q{background:#17243a;border-color:#2a405e;color:#f5f8ff;}',
  '.guest-q-status{display:inline-flex;align-items:center;gap:7px;width:max-content;margin-left:2px;color:#567093;font-size:13px;font-weight:700;}.guest-q-status--ai{color:#007b65;}',
  '.guest-q-error{padding:11px 14px;border-radius:12px;background:#fff0ee;color:#b0362c;font-size:14px;}.guest-q-chips{display:flex;flex-wrap:wrap;gap:9px;}.guest-q-chip{border:1px solid #cad8ea;border-radius:999px;background:#fff;color:#27405f;padding:9px 13px;font:inherit;cursor:pointer;animation:guestQIn .18s ease-out both;}.guest-q-chip:nth-child(2){animation-delay:.04s;}.guest-q-chip:nth-child(3){animation-delay:.08s;}.guest-q-chip:nth-child(4){animation-delay:.12s;}.guest-q-chip:nth-child(5){animation-delay:.16s;}.guest-q-chip:hover{border-color:#2f7df6;color:#1263d9;}.guest-q-jump{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:6px;border:1px solid #c7d5e7;border-radius:999px;background:#ffffff;color:#1b2b43;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(15,30,55,.18);z-index:2;}.guest-q-overlay[data-theme=dark] .guest-q-jump{background:#17243a;border-color:#2a405e;color:#f5f8ff;}',
  '.guest-q-typing{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;padding:12px 16px;border:1px solid #dce5f0;border-radius:18px;border-bottom-left-radius:5px;background:#fff;animation:guestQIn .18s ease-out both;}.guest-q-overlay[data-theme=dark] .guest-q-typing{background:#17243a;border-color:#2a405e;}.guest-q-typing span{width:7px;height:7px;border-radius:50%;background:#8ba1bd;animation:guestQTyping 1.2s ease-in-out infinite;}.guest-q-typing span:nth-child(2){animation-delay:.15s;}.guest-q-typing span:nth-child(3){animation-delay:.3s;}',
  '@keyframes guestQIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}',
  '@keyframes guestQTyping{0%,60%,100%{transform:translateY(0);opacity:.45;}30%{transform:translateY(-4px);opacity:1;}}',
  '@media(prefers-reduced-motion:reduce){.guest-q-bubble,.guest-q-chip,.guest-q-typing,.guest-q-typing span{animation:none !important;}}',
  '.guest-q-form{display:flex;flex:0 0 auto;gap:10px;padding-top:6px;}.guest-q-input{min-width:0;flex:1;border:1px solid #c7d5e7;border-radius:15px;background:#fff;color:#18263a;padding:14px 16px;font:inherit;font-size:16px;}.guest-q-input:focus{outline:2px solid #7cadff;outline-offset:1px;}.guest-q-send{display:grid;place-items:center;width:54px;border:0;border-radius:15px;background:#14223a;color:#fff;cursor:pointer;}.guest-q-send:disabled{opacity:.45;cursor:not-allowed;}',
  '.guest-q-brief{display:flex;flex-direction:column;gap:16px;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:24px;border-left:1px solid #e3e9f2;background:#fbfcff;}.guest-q-overlay[data-theme=dark] .guest-q-brief{background:#101c2e;border-color:#273b58;}.guest-q-brief h3{margin:0;font-size:19px;}.guest-q-brief p{margin:0;color:#637898;line-height:1.55;}.guest-q-modules{display:flex;flex-wrap:wrap;gap:7px;}.guest-q-modules span{padding:7px 9px;border-radius:999px;background:#fff2e4;color:#b85200;font-size:13px;font-weight:700;}.guest-q-overlay[data-theme=dark] .guest-q-modules span{background:#3b2b20;color:#ffbd7b;}',
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
  onContinue: (setup: GuestSetup) => void;
}) {
  const firstSetup = useMemo(() => initialSetup(initialPrompt), [initialPrompt]);
  const [setup, setSetup] = useState(firstSetup);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [recommendedModules, setRecommendedModules] = useState<string[]>([]);
  const [readyForSignIn, setReadyForSignIn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [replyMode, setReplyMode] = useState<'ai' | 'guided' | 'pending'>('pending');
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const messageId = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const setupRef = useRef(firstSetup);
  const startedRef = useRef(false);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pinnedRef = useRef(true);

  const appendMessage = useCallback((from: Message['from'], text: string) => {
    const next = [...messagesRef.current, { id: ++messageId.current, from, text }];
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim().slice(0, 1200);
      if (!message || isSending) return;

      const history = messagesRef.current.slice(-8).map((item) => ({
        role: item.from === 'user' ? 'user' : 'assistant',
        content: item.text,
      }));

      pinnedRef.current = true;
      appendMessage('user', message);
      setInput('');
      setError('');
      setQuickReplies([]);
      setIsSending(true);

      try {
        const result = await http.post<PublicConciergeResponse>('/public/q-concierge', {
          message,
          history,
          draft: setupRef.current,
        });
        const nextSetup = mergeSetup(setupRef.current, result.updates);
        setupRef.current = nextSetup;
        setSetup(nextSetup);
        setQuickReplies(listOf(result.suggestedReplies, 5));
        setRecommendedModules(listOf(result.recommendedModules, 12));
        setReadyForSignIn(Boolean(result.readyForSignIn));
        setReplyMode(result.mode);
        appendMessage('q', textOf(result.reply, 2400) || 'I could not prepare a reply. Please try again.');
      } catch {
        setError('Q is temporarily unavailable. Please try again in a moment.');
      } finally {
        setIsSending(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [appendMessage, isSending],
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

  const modules = recommendedModules.length ? recommendedModules : fallbackModules(setup);
  const canContinue = readyForSignIn && emailPattern.test(setup.email);
  const continueHint = emailPattern.test(setup.email)
    ? 'Q is still preparing your setup — a few more answers to go.'
    : 'Share your email in the chat to unlock secure sign-in.';
  const brief = [
    'Q360 setup brief',
    setup.businessName ? 'Business: ' + setup.businessName : '',
    setup.businessType ? 'Type: ' + setup.businessType : '',
    setup.country ? 'Country: ' + setup.country : '',
    setup.tables ? 'Tables: ' + setup.tables : '',
    setup.employees ? 'Team members: ' + setup.employees : '',
    setup.services.length ? 'Services: ' + setup.services.join(', ') : '',
    'Recommended modules: ' + modules.join(', '),
  ]
    .filter(Boolean)
    .join('\n');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Your browser could not copy the brief. You can select and copy it manually.');
    }
  };

  return (
    <div className={'guest-q-overlay guest-q-overlay--' + theme} data-theme={theme} role="dialog" aria-modal="true" aria-label="Q Concierge">
      <style>{guestQStyles}</style>
      <section className="guest-q-modal">
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
              {replyMode === 'ai' ? 'Q is preparing a tailored plan' : replyMode === 'guided' ? 'Q is guiding your setup' : 'Q is ready to help'}
            </div>

            <div className="guest-q-messages-wrap">
              <div className="guest-q-messages" ref={messageScrollRef} onScroll={handleMessagesScroll}>
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
                      <button key={reply} type="button" className="guest-q-chip" onClick={() => void sendMessage(reply)} disabled={isSending}>
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

            {error ? <div className="guest-q-error">{error}</div> : null}

            <form className="guest-q-form" onSubmit={submit}>
              <input
                ref={inputRef}
                className="guest-q-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Reply to Q..."
                aria-label="Message Q"
                autoFocus
              />
              <button className="guest-q-send" type="submit" disabled={!input.trim() || isSending} aria-label="Send message">
                <Send size={21} />
              </button>
            </form>
          </div>

          <aside className="guest-q-brief">
            <div>
              <h3>{canContinue ? 'Your setup brief is ready' : 'Your workspace plan'}</h3>
              <p>{canContinue ? 'Review this recommended setup, then sign in securely to save it.' : 'Q will recommend the right tools as it learns how your business works.'}</p>
            </div>
            <div className="guest-q-modules">
              {modules.map((module) => (
                <span key={module}>{module}</span>
              ))}
            </div>
            {setup.businessType || setup.businessName || setup.country ? (
              <p>
                {[setup.businessName, setup.businessType, setup.country].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            <div className="guest-q-brief-actions">
              <button type="button" className="guest-q-button" onClick={() => void copyBrief()}>
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copied' : 'Copy brief'}
              </button>
              <button type="button" className="guest-q-button guest-q-button--primary" onClick={() => onContinue(setup)} disabled={!canContinue}>
                Continue securely <ArrowRight size={17} />
              </button>
            </div>
            {!canContinue ? <div className="guest-q-note">{continueHint}</div> : null}
            <div className="guest-q-note">Q does not need your password or payment details. You remain in control of every decision.</div>
          </aside>
        </div>
      </section>
    </div>
  );
}
