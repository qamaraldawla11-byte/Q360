import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Copy,
  Lightbulb,
  Lock,
  MapPin,
  Send,
  Settings,
  Store,
  Target,
  Users,
  X,
} from 'lucide-react';
import { http } from '@/api/http';
import { LogoMark } from '@/components/ui/Logo';
import { BrandLogo } from './BrandLogo';
import {
  activeDimension,
  deriveQuickReplies,
  determineNextPresentation,
  dimensionStates,
  emailPattern,
  FIELD_ORDER,
  fallbackModules,
  fieldDefByKey,
  formatFieldValue,
  hasInlineSkip,
  initialJourney,
  initialSetup,
  isChangeMessage,
  isConfirmMessage,
  isContinueMessage,
  isOwnerNameStatement,
  isSkipMessage,
  isStaleQuickReply,
  isStaleRevision,
  listOf,
  mergeSetup,
  nextField,
  openingAcknowledgement,
  ownerNameFromStatement,
  parseActiveAnswer,
  requiredComplete,
  requiredFields,
  requiredProgress,
  replyAsksField,
  syncJourney,
  textOf,
  understandingPercent,
  type DnaDimensionKey,
  type FieldKey,
  type FieldStatus,
  type GuestSetup,
} from './guestQConciergeState';

export type { GuestSetup } from './guestQConciergeState';

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

const fieldKeyForUpdateKey = (key: keyof GuestSetup): FieldKey | undefined => {
  switch (key) {
    case 'businessType':
      return 'businessType';
    case 'services':
    case 'serviceMode':
      return 'serviceMode';
    case 'businessName':
      return 'businessName';
    case 'country':
      return 'country';
    case 'email':
      return 'email';
    case 'tables':
      return 'tables';
    case 'employees':
      return 'teamSize';
    case 'priorities':
      return 'priorities';
    case 'stockConcerns':
      return 'stockConcerns';
    case 'bookings':
      return 'bookings';
    case 'otherPreferences':
      return 'otherPreferences';
    default:
      return undefined;
  }
};

const DNA_RING_C = 2 * Math.PI * 62;

const dnaIcon = (key: DnaDimensionKey) => {
  if (key === 'business') return Store;
  if (key === 'locations') return MapPin;
  if (key === 'operations') return Settings;
  if (key === 'team') return Users;
  return Target;
};

const DNA_INSIGHT: Record<DnaDimensionKey, string> = {
  business: 'Q is learning your business.',
  locations: 'Q is learning your locations.',
  operations: 'Q is learning your operations.',
  team: 'Q is learning your team.',
  goals: 'Q is learning your goals.',
};

/** Node anchor points on the DNA map (percent of the map container, node centers).
 *  Tuned for the approved 35 % desktop panel: large vertical separation
 *  between the upper and lower node pairs, Goals clear below the center,
 *  and no node text crossing the understanding ring. */
const DNA_POS: Record<DnaDimensionKey, { x: number; y: number }> = {
  business: { x: 16, y: 30 },
  locations: { x: 84, y: 30 },
  operations: { x: 16, y: 78 },
  team: { x: 84, y: 78 },
  goals: { x: 50, y: 88 },
};

const guestQStyles = [
  ':root{--q-bg:#ffffff;--q-surface:#fafafa;--q-text:#0a0a0a;--q-text-secondary:#5a6a7d;--q-border:#eeeeee;--q-border-strong:#e0e0e0;--q-accent:#e36b00;--q-accent-soft:#fff6ed;--q-momentum:#ff6a00;--q-q-bubble:#ffffff;--q-user-bubble:#0a0a0a;--q-success:#007b65;--q-error:#b0362c;--q-focus:#7cadff;}',
  '.guest-q-overlay{position:fixed;inset:0;z-index:2000;height:100dvh;display:grid;place-items:center;padding:24px;background:rgba(13,24,43,.55);backdrop-filter:blur(12px);overflow:hidden;overscroll-behavior:none;}',
  '.guest-q-modal{isolation:isolate;width:min(1180px,100%);height:min(860px,calc(100dvh - 48px));max-height:calc(100dvh - 48px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--q-border);border-radius:28px;background:var(--q-bg);color:var(--q-text);box-shadow:0 28px 90px rgba(15,30,55,.35);}',
  '.guest-q-overlay[data-theme=dark]{--q-bg:#0f1a2c;--q-surface:#121c2e;--q-text:#f5f8ff;--q-text-secondary:#90a0b8;--q-border:#273b58;--q-border-strong:#2b405f;--q-accent:#ff9a3c;--q-accent-soft:#3b2b20;--q-q-bubble:#17243a;--q-user-bubble:#1e2d46;}',
  '.guest-q-header{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:16px;padding:18px 26px;border-bottom:1px solid var(--q-border);}',
  '.guest-q-brand{display:flex;align-items:center;gap:12px;}',
  '.guest-q-brand-text{font-size:20px;font-weight:800;letter-spacing:-0.02em;}',
  '.guest-q-header-status{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--q-text-secondary);}',
  '.guest-q-status-dot{width:8px;height:8px;border-radius:50%;background:var(--q-accent);}',
  '.guest-q-close{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer;padding:8px;border-radius:10px;color:var(--q-text-secondary);}.guest-q-close:hover{background:var(--q-surface);color:var(--q-text);}',
  '.guest-q-content{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(320px,0.7fr);flex:1 1 0;height:0;min-height:0;overflow:hidden;}',
  '.guest-q-chat{height:100%;max-height:100%;min-height:0;display:flex;flex-direction:column;padding:30px 34px 24px;gap:18px;overflow:hidden;}',
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
  '@media(prefers-reduced-motion:reduce){.guest-q-bubble,.guest-q-chip,.guest-q-action,.guest-q-typing,.guest-q-typing span,.guest-q-message,.guest-q-dna-q,.guest-q-dna-q-sweep,.guest-q-dna-link,.guest-q-node-orb,.guest-q-node-badge{animation:none !important;}.guest-q-dna-arc{transition:none !important;}}',
  '.guest-q-form{position:relative;flex:0 0 auto;display:flex;align-items:flex-end;gap:12px;padding-top:6px;}',
  '.guest-q-input{min-width:0;flex:1;border:0;border-bottom:1px solid var(--q-border-strong);border-radius:0;background:transparent;color:var(--q-text);padding:16px 52px 16px 0;font:inherit;font-size:17px;line-height:1.45;}.guest-q-input:focus{outline:none;border-bottom-color:var(--q-accent);}.guest-q-input::placeholder{color:#9aa5b8;}',
  '.guest-q-send{position:absolute;right:0;bottom:4px;display:grid;place-items:center;width:48px;height:48px;border:0;border-radius:50%;background:var(--q-accent);color:#fff;cursor:pointer;transition:transform .1s ease,background .15s ease;}.guest-q-send:hover{background:#c75c00;}.guest-q-send:disabled{opacity:.45;cursor:not-allowed;}.guest-q-send:focus-visible{outline:2px solid var(--q-focus);outline-offset:2px;}',
  '.guest-q-input-note{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--q-text-secondary);margin-top:6px;}',
  '.guest-q-error{padding:12px 14px;border-radius:12px;background:#fff0ee;color:var(--q-error);font-size:14px;}',
  '.guest-q-brief{display:flex;flex-direction:column;gap:22px;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:28px;border-left:1px solid var(--q-border);background:var(--q-surface);container-type:inline-size;container-name:dna-panel;}',
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
  '.guest-q-module svg{width:17px;height:17px;color:var(--q-accent);flex-shrink:0;}',
  '.guest-q-brief-actions{display:flex;flex-direction:column;gap:10px;margin-top:auto;}.guest-q-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--q-border-strong);border-radius:14px;background:var(--q-bg);color:var(--q-text);padding:12px 14px;font:inherit;font-weight:700;cursor:pointer;}.guest-q-button:disabled{opacity:.45;cursor:not-allowed;}.guest-q-button--primary{border-color:var(--q-text);background:var(--q-text);color:#fff;padding:16px 18px;font-size:16px;}.guest-q-button--primary:hover{background:#1a1a1a;border-color:#1a1a1a;color:#fff;}.guest-q-button:focus-visible{outline:2px solid var(--q-focus);outline-offset:2px;}',
  '.guest-q-note{font-size:13px;color:var(--q-text-secondary);line-height:1.5;}',
  '.guest-q-dna-subtitle{margin:2px 0 0;font-size:14px;line-height:1.5;color:var(--q-text-secondary);}',
  '.guest-q-dna-map{position:relative;height:430px;margin-top:6px;}',
  '.guest-q-dna-links{position:absolute;inset:0;width:100%;height:100%;}',
  '.guest-q-dna-link{stroke:var(--q-border-strong);stroke-width:1.5;stroke-dasharray:3 5;opacity:.75;transition:stroke .3s ease;}',
  '.guest-q-dna-link.is-live{stroke:color-mix(in srgb,var(--q-momentum) 55%,transparent);}',
  '.guest-q-dna-link.is-active{stroke:var(--q-momentum);animation:guestQDnaLink 2.4s linear infinite;}',
  '.guest-q-dna-ringwrap{position:absolute;left:50%;top:0;transform:translateX(-50%);}',
  '.guest-q-dna-ringwrap.is-learning .guest-q-dna-arc{filter:drop-shadow(0 0 6px rgba(255,106,0,.5));}',
  '.guest-q-dna-ringwrap.is-prepared .guest-q-dna-arc{filter:drop-shadow(0 0 8px rgba(255,106,0,.55));}',
  '.guest-q-dna-ring{position:relative;width:94px;height:94px;}',
  '.guest-q-dna-ring>svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);}',
  '.guest-q-dna-track{fill:none;stroke:var(--q-border-strong);stroke-width:9;}',
  '.guest-q-dna-arc{fill:none;stroke:var(--q-momentum);stroke-width:9;stroke-linecap:round;transition:stroke-dashoffset .9s cubic-bezier(.16,1,.3,1);}',
  '.guest-q-dna-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;}',
  '.guest-q-dna-percent{font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1;color:var(--q-text);}',
  '.guest-q-dna-percent-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--q-text-secondary);}',
  '.guest-q-dna-core{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--q-accent-soft);box-shadow:0 0 0 9px color-mix(in srgb,var(--q-momentum) 7%,transparent),0 0 32px color-mix(in srgb,var(--q-momentum) 18%,transparent);}',
  '.guest-q-dna-q{display:block;width:30px;height:30px;color:var(--q-momentum);}',
  '.guest-q-dna-q svg{display:block;width:100%;height:100%;}',
  '.guest-q-dna-q-base,.guest-q-dna-q-tail{fill:none;stroke:currentColor;stroke-width:5;stroke-linecap:round;}',
  '.guest-q-dna-q-base{stroke-opacity:.32;transition:stroke-opacity .4s ease;}',
  '.guest-q-dna-q-sweep{fill:none;stroke:currentColor;stroke-width:5;stroke-linecap:round;stroke-dasharray:24 76;opacity:0;transition:opacity .3s ease;transform-origin:22px 22px;}',
  '.guest-q-dna-q.is-idle{animation:guestQDnaBreath 4.4s ease-in-out infinite;}',
  '.guest-q-dna-q.is-learning .guest-q-dna-q-base{stroke-opacity:.55;}',
  '.guest-q-dna-q.is-learning .guest-q-dna-q-sweep{opacity:1;animation:guestQDnaSweep 2.2s linear infinite;}',
  '.guest-q-dna-q.is-prepared{filter:drop-shadow(0 0 12px rgba(255,106,0,.45));}',
  '.guest-q-dna-q.is-prepared .guest-q-dna-q-base{stroke-opacity:1;}',
  '.guest-q-node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;width:104px;text-align:center;}',
  '.guest-q-node-orb{position:relative;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--q-bg);border:1px solid var(--q-border-strong);color:var(--q-text-secondary);transition:border-color .3s ease,color .3s ease;}',
  '.guest-q-node-orb svg{width:19px;height:19px;}',
  '.guest-q-node-badge{position:absolute;bottom:-2px;right:-2px;display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:var(--q-success);color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);animation:guestQDnaPop .5s cubic-bezier(.16,1,.3,1) both;}',
  '.guest-q-node.is-learning .guest-q-node-orb{border-color:var(--q-momentum);color:var(--q-momentum);animation:guestQDnaOrbPulse 2.4s ease-in-out infinite;}',
  '.guest-q-node.is-understood .guest-q-node-orb{color:var(--q-success);}',
  '.guest-q-node.is-next{opacity:.72;}',
  '.guest-q-node-name{font-size:12.5px;font-weight:700;color:var(--q-text);}',
  '.guest-q-node-status{font-size:11px;font-weight:700;letter-spacing:.04em;}',
  '.guest-q-node.is-understood .guest-q-node-status{color:var(--q-success);}',
  '.guest-q-node.is-learning .guest-q-node-status{color:var(--q-momentum);}',
  '.guest-q-node.is-next .guest-q-node-status{color:var(--q-text-secondary);font-weight:600;}',
  '.guest-q-node-facts{display:flex;flex-direction:column;gap:3px;align-items:center;max-width:100%;}',
  '.guest-q-node-facts i{font-style:normal;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--q-accent-soft);color:var(--q-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:98px;}',
  '.guest-q-insight{display:flex;gap:10px;align-items:flex-start;padding:13px 15px;border-radius:14px;background:var(--q-accent-soft);border:1px solid color-mix(in srgb,var(--q-momentum) 18%,transparent);}',
  '.guest-q-insight svg{flex:0 0 auto;color:var(--q-momentum);margin-top:1px;}',
  '.guest-q-insight-title{margin:0;font-size:13.5px;font-weight:700;color:var(--q-text);line-height:1.4;}',
  '.guest-q-insight-body{margin:3px 0 0;font-size:12.5px;line-height:1.5;color:var(--q-text-secondary);}',
  '.guest-q-dna-principle{padding-top:4px;font-size:12.5px;font-weight:700;letter-spacing:.05em;text-align:center;color:var(--q-text-secondary);}',
  '.guest-q-setup-row{display:flex;align-items:center;gap:14px;}',
  '.guest-q-setup-count{font-size:13px;font-weight:800;color:var(--q-text);white-space:nowrap;}',
  '.guest-q-setup-rail{position:relative;display:flex;align-items:center;justify-content:space-between;flex:1;padding:2px 0;}',
  '.guest-q-setup-rail::before{content:"";position:absolute;left:4px;right:4px;top:50%;height:2px;transform:translateY(-50%);background:var(--q-border-strong);border-radius:2px;}',
  '.guest-q-setup-rail i{position:relative;z-index:1;width:9px;height:9px;border-radius:50%;background:var(--q-bg);border:1.5px solid var(--q-border-strong);}',
  '.guest-q-setup-rail i.is-done{background:var(--q-momentum);border-color:var(--q-momentum);box-shadow:0 0 8px color-mix(in srgb,var(--q-momentum) 45%,transparent);}',
  '@keyframes guestQDnaBreath{0%,100%{opacity:.7;transform:scale(1);}50%{opacity:1;transform:scale(1.06);}}',
  '@keyframes guestQDnaSweep{to{transform:rotate(360deg);}}',
  '@keyframes guestQDnaLink{to{stroke-dashoffset:-16;}}',
  '@keyframes guestQDnaPop{from{transform:scale(0);}to{transform:scale(1);}}',
  '@keyframes guestQDnaOrbPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--q-momentum) 32%,transparent);}50%{box-shadow:0 0 0 7px transparent;}}',
  '@container dna-panel (max-width:420px){.guest-q-brief{gap:16px;padding:20px;}.guest-q-dna-map{height:400px;margin-top:4px;}.guest-q-dna-ring{width:64px;height:64px;}.guest-q-dna-track,.guest-q-dna-arc{stroke-width:7;}.guest-q-dna-percent{font-size:19px;}.guest-q-dna-percent-label{font-size:9px;letter-spacing:.08em;}.guest-q-dna-core{width:46px;height:46px;box-shadow:0 0 0 5px color-mix(in srgb,var(--q-momentum) 7%,transparent),0 0 18px color-mix(in srgb,var(--q-momentum) 18%,transparent);}.guest-q-dna-q{width:20px;height:20px;}.guest-q-node{width:84px;gap:2px;}.guest-q-node-orb{width:36px;height:36px;}.guest-q-node-orb svg{width:15px;height:15px;}.guest-q-node-facts i{padding:1px 5px;max-width:76px;}.guest-q-insight{padding:11px 13px;}.guest-q-insight-title{font-size:12.5px;}.guest-q-insight-body{font-size:11.5px;}.guest-q-dna-principle{font-size:11.5px;}}',
  '@media(max-width:900px){.guest-q-dna-map{height:auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 14px;margin-top:10px;padding-bottom:4px;}.guest-q-dna-links{display:none;}.guest-q-dna-ringwrap{position:static;transform:none;order:-2;}.guest-q-dna-ring{width:64px;height:64px;}.guest-q-dna-percent{font-size:14px;}.guest-q-dna-core{position:static;transform:none;order:-1;width:42px;height:42px;box-shadow:0 0 0 6px color-mix(in srgb,var(--q-momentum) 7%,transparent);}.guest-q-dna-core .guest-q-dna-q{width:20px;height:20px;}.guest-q-node{position:static;transform:none;width:auto;min-width:60px;gap:2px;}.guest-q-node-orb{width:32px;height:32px;}.guest-q-node-orb svg{width:14px;height:14px;}.guest-q-node-name{font-size:10.5px;}.guest-q-node-status{font-size:9px;}.guest-q-node-facts{display:none;}}',
  '@media(max-width:900px){.guest-q-overlay{padding:0;align-items:stretch;overflow:hidden;}.guest-q-modal{width:100%;height:100dvh;max-height:100dvh;border-radius:0;}.guest-q-content{display:flex;flex:1 1 0;flex-direction:column;height:0;min-height:0;overflow:hidden;grid-template-columns:none;}.guest-q-chat{flex:1 1 0;height:auto;max-height:none;min-height:0;overflow:hidden;padding:18px;}.guest-q-messages{flex:1 1 0;min-height:0;overflow-y:auto;padding-right:3px;}.guest-q-brief{flex:0 0 auto;max-height:46dvh;min-height:220px;overflow-y:auto;border-left:0;border-top:1px solid var(--q-border);padding:20px;}.guest-q-message{max-width:92%;}.guest-q-header{padding:14px 18px;}.guest-q-brand-text{font-size:18px;}.guest-q-plan-title{font-size:26px;}}',
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
  const [journeyRevision, setJourneyRevision] = useState(0);
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
  const journeyRevisionRef = useRef(0);
  const reviewReadyRef = useRef(false);
  const startedRef = useRef(false);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const pinnedRef = useRef(true);
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null) {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  useEffect(() => {
    reviewReadyRef.current = reviewReady;
  }, [reviewReady]);

  const setActiveFieldAndRef = useCallback((field: FieldKey | null) => {
    activeFieldRef.current = field;
    setActiveField(field);
    journeyRevisionRef.current += 1;
    setJourneyRevision(journeyRevisionRef.current);
    setQuickReplies(deriveQuickReplies(field, setupRef.current, journeyRef.current));
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

  const askField = useCallback(
    (key: FieldKey) => {
      const def = fieldDefByKey[key];
      const status = journeyRef.current[key];
      const text =
        status === 'captured' ? def.confirmQuestion(setupRef.current) : def.question(setupRef.current);
      const lastMessage = messagesRef.current[messagesRef.current.length - 1];
      if (lastMessage?.from === 'q' && (lastMessage.text === text || replyAsksField(lastMessage.text, key, setupRef.current))) {
        // The question is already the most recent Q message; just sync controls.
        setActiveFieldAndRef(key);
        return;
      }
      appendMessage('q', text);
      setActiveFieldAndRef(key);
    },
    [appendMessage, setActiveFieldAndRef],
  );

  const goToReview = useCallback(() => {
    if (reviewReadyRef.current) return;
    setReviewReadyAndRef(true);
    setActiveFieldAndRef(null);
    appendMessage(
      'q',
      'Your Q360 setup brief is ready. Review the recommended workspace, then continue securely to save it.',
    );
  }, [appendMessage, setActiveFieldAndRef, setReviewReadyAndRef]);

  const askNextField = useCallback(() => {
    if (reviewReadyRef.current) return;
    const next = nextField(setupRef.current, journeyRef.current);
    if (!next) {
      goToReview();
      return;
    }
    askField(next);
  }, [askField, goToReview]);

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
          askNextField();
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
          askNextField();
          setInput('');
          return;
        }
        if (isChangeMessage(message)) {
          appendMessage('user', message);
          resetField(activeKey);
          askNextField();
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
          askNextField();
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

      // If the active field is strict (businessName/country/priorities) and the answer
      // cannot be parsed for that field, ask for clarification instead of guessing or
      // sending it to the backend.
      if (
        !hasActiveAnswer &&
        pendingField &&
        (pendingField === 'businessName' || pendingField === 'country' || pendingField === 'priorities') &&
        !isSkipMessage(message) &&
        !isConfirmMessage(message) &&
        !isChangeMessage(message)
      ) {
        let clarification = '';
        if (pendingField === 'businessName') {
          clarification = `That doesn't sound like a business name. What is the name of your ${setupRef.current.businessType || 'business'}?`;
        } else if (pendingField === 'country') {
          const name = setupRef.current.businessName ? `“${setupRef.current.businessName}”` : 'the business';
          clarification = `I don't recognize that country. Which country will ${name} operate in?`;
        } else if (pendingField === 'priorities') {
          clarification =
            'Could you tell me what matters most? For example, sales, stock, customers, or fast checkout.';
        }
        appendMessage('q', clarification);
        setIsSending(false);
        return;
      }

      // Confirm the active field, or any volunteered facts parsed when no field was active.
      // Volunteered facts come from reliable local parsers, so they can be confirmed directly.
      // Map parsed GuestSetup keys to journey FieldKeys (e.g. employees → teamSize)
      // so volunteered facts confirm the fields they actually belong to; otherwise
      // Q would re-ask for something the owner already said.
      const volunteeredKeys = (Object.entries(activeFieldAnswer) as Array<[keyof GuestSetup, unknown]>)
        .filter(([, value]) => value !== undefined && value !== '' && value !== null && value !== false)
        .map(([key]) => fieldKeyForUpdateKey(key))
        .filter((key): key is FieldKey => Boolean(key));
      const keysToConfirm = pendingField
        ? hasActiveAnswer
          ? [pendingField]
          : []
        : [...new Set(volunteeredKeys)];

      if (keysToConfirm.length > 0) {
        const preSetup = mergeSetup(setupRef.current, activeFieldAnswer);
        setupRef.current = preSetup;
        setSetup(preSetup);
        const preJourney = { ...journeyRef.current };
        for (const key of keysToConfirm) {
          preJourney[key] = 'confirmed';
        }
        journeyRef.current = preJourney;
        setJourney(preJourney);
      }

      const requestRevision = journeyRevisionRef.current;
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

        // If the user has already moved to a different question, this response is stale.
        if (isStaleRevision(requestRevision, journeyRevisionRef.current)) {
          setIsSending(false);
          window.requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }

        // Backend inference may only fill missing or captured fields; confirmed and
        // skipped fields are authoritative and must not be overwritten.
        const backendUpdates: Partial<GuestSetup> = {};
        if (result.updates) {
          for (const [key, value] of Object.entries(result.updates) as Array<[keyof GuestSetup, unknown]>) {
            const fieldKey = fieldKeyForUpdateKey(key);
            if (!fieldKey) continue;
            const status = journeyRef.current[fieldKey];
            if (status !== 'confirmed' && status !== 'skipped') {
              (backendUpdates as Record<string, unknown>)[key] = value;
            }
          }
        }
        let nextSetup = mergeSetup(setupRef.current, backendUpdates);
        const localUpdates = parseActiveAnswer(message, pendingField, nextSetup);
        nextSetup = mergeSetup(nextSetup, localUpdates);
        setupRef.current = nextSetup;
        setSetup(nextSetup);

        const nextJourney = syncJourney(nextSetup, journeyRef.current, pendingField, false);
        journeyRef.current = nextJourney;
        setJourney(nextJourney);

        setRecommendedModules(listOf(result.recommendedModules, 12));
        setReplyMode(result.mode);

        const backendReply = textOf(result.reply, 2400);
        const presentation = determineNextPresentation(backendReply, setupRef.current, journeyRef.current);

        if (presentation.backendReply) {
          appendMessage('q', presentation.backendReply);
        }

        if (presentation.next.type === 'review') {
          goToReview();
        } else if (presentation.next.type === 'activate') {
          setActiveFieldAndRef(presentation.next.field);
        } else {
          askField(presentation.next.field);
        }
      } catch {
        setError('Q is temporarily unavailable. Please try again in a moment.');
      } finally {
        setIsSending(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [appendMessage, isSending, askNextField, askField, goToReview, markSkipped, resetField, setActiveFieldAndRef],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const prompt = initialPrompt.trim() || 'Hello';
    // sendMessage runs synchronously up to the network call: the owner's bubble and
    // the locally confirmed facts are already in place before Q acknowledges them.
    void sendMessage(prompt);
    appendMessage('q', openingAcknowledgement(setupRef.current));
  }, [initialPrompt, sendMessage, appendMessage]);

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

  const canContinue = requiredComplete(setup, journey);
  const modules = recommendedModules.length ? recommendedModules : fallbackModules(setup);

  const missingRequired = requiredFields(setup).filter(
    (key) => journey[key] === 'missing' || !fieldDefByKey[key].hasValue(setup),
  );

  const dnaDimensions = dimensionStates(setup, journey);
  const dnaPercentRaw = understandingPercent(setup, journey);
  const [dnaPercentPeak, setDnaPercentPeak] = useState(0);
  useEffect(() => {
    // Field applicability shifts as businessType lands; never let the ring regress.
    setDnaPercentPeak((peak) => Math.max(peak, dnaPercentRaw));
  }, [dnaPercentRaw]);
  const dnaPercent = reviewReady ? 100 : dnaPercentPeak;
  const dnaActive = activeDimension(setup, journey, activeField);
  const qMood: 'idle' | 'learning' | 'prepared' = reviewReady ? 'prepared' : isSending ? 'learning' : 'idle';
  const setupProgress = requiredProgress(setup, journey);

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
      journey[activeField] !== 'confirmed' &&
      !hasInlineSkip(activeField)
    : false;
  const requiredHaveValues = requiredFields(setup).every((key) => fieldDefByKey[key].hasValue(setup));
  const showDefaults = requiredHaveValues && !reviewReady;

  const handleNext = useCallback(() => {
    if (!activeFieldRef.current) return;
    const key = activeFieldRef.current;
    if (journeyRef.current[key] === 'captured') {
      const nextJourney = { ...journeyRef.current, [key]: 'confirmed' };
      journeyRef.current = nextJourney;
      setJourney(nextJourney);
      askNextField();
    }
  }, [askNextField]);

  const handleSkip = useCallback(() => {
    if (!activeFieldRef.current) return;
    const key = activeFieldRef.current;
    if (!fieldDefByKey[key].required(setupRef.current)) {
      markSkipped(key);
      askNextField();
    }
  }, [askNextField, markSkipped]);

  const handleUseDefaults = useCallback(() => {
    // The user is explicitly accepting any inferred defaults, so promote captured
    // applicable fields to confirmed before finishing optional ones.
    const nextJourney = { ...journeyRef.current };
    for (const key of FIELD_ORDER) {
      const def = fieldDefByKey[key];
      if (
        def.applicable(setupRef.current) &&
        nextJourney[key] === 'captured' &&
        def.hasValue(setupRef.current)
      ) {
        nextJourney[key] = 'confirmed';
      }
    }
    journeyRef.current = nextJourney;
    setJourney(nextJourney);
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
          <div className="guest-q-brand">
            <BrandLogo height={34} theme={theme} />
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
                      {quickReplies.map((reply) => {
                        const expectedField = activeField;
                        const expectedRevision = journeyRevision;
                        return (
                          <button
                            key={reply}
                            type="button"
                            className="guest-q-chip"
                            onClick={() => {
                              if (
                                expectedField &&
                                activeFieldRef.current === expectedField &&
                                journeyRevisionRef.current === expectedRevision &&
                                !isStaleQuickReply(reply, expectedField, setupRef.current, journeyRef.current)
                              ) {
                                void sendMessage(reply);
                              }
                            }}
                            disabled={isSending}
                          >
                            {reply}
                          </button>
                        );
                      })}
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
                placeholder="Reply to Q…"
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

          <aside className="guest-q-brief" aria-label="Your business DNA">
            <div>
              <div className="guest-q-plan-label">Your Business DNA</div>
              <p className="guest-q-dna-subtitle">Q is learning how your business works.</p>
            </div>

            <div className="guest-q-dna-map">
              <svg className="guest-q-dna-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line
                  className="guest-q-dna-link"
                  x1="50"
                  y1="16"
                  x2="50"
                  y2="42"
                  vectorEffect="non-scaling-stroke"
                />
                {dnaDimensions.map((node) => (
                  <line
                    key={node.key}
                    x1="50"
                    y1="52"
                    x2={DNA_POS[node.key].x}
                    y2={DNA_POS[node.key].y}
                    className={
                      'guest-q-dna-link' +
                      (node.status !== 'next' ? ' is-live' : '') +
                      (node.key === dnaActive ? ' is-active' : '')
                    }
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <div className={'guest-q-dna-ringwrap is-' + qMood}>
                <div
                  className="guest-q-dna-ring"
                  role="img"
                  aria-label={`Q understands ${dnaPercent}% of your business so far`}
                >
                  <svg viewBox="0 0 148 148" aria-hidden="true">
                    <circle className="guest-q-dna-track" cx="74" cy="74" r="62" />
                    <circle
                      className="guest-q-dna-arc"
                      cx="74"
                      cy="74"
                      r="62"
                      style={{
                        strokeDasharray: DNA_RING_C,
                        strokeDashoffset: DNA_RING_C * (1 - dnaPercent / 100),
                      }}
                    />
                  </svg>
                  <div className="guest-q-dna-center">
                    <span className="guest-q-dna-percent">{dnaPercent}%</span>
                    <span className="guest-q-dna-percent-label">understood</span>
                  </div>
                </div>
              </div>
              <div className="guest-q-dna-core">
                <span className={'guest-q-dna-q is-' + qMood}>
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <circle className="guest-q-dna-q-base" cx="22" cy="22" r="15" />
                    <path className="guest-q-dna-q-tail" d="M31.5 31.5 L39.5 39.5" />
                    <circle className="guest-q-dna-q-sweep" cx="22" cy="22" r="15" pathLength={100} />
                  </svg>
                </span>
              </div>
              {dnaDimensions.map((node) => {
                const Icon = dnaIcon(node.key);
                const pos = DNA_POS[node.key];
                return (
                  <div
                    key={node.key + ':' + node.status}
                    className={'guest-q-node is-' + node.status + (node.key === dnaActive ? ' is-active' : '')}
                    style={{ left: pos.x + '%', top: pos.y + '%' }}
                  >
                    <span className="guest-q-node-orb">
                      <Icon />
                      {node.status === 'understood' ? (
                        <span className="guest-q-node-badge">
                          <Check size={9} />
                        </span>
                      ) : null}
                    </span>
                    <span className="guest-q-node-name">{node.title}</span>
                    <span className="guest-q-node-status">
                      {node.status === 'understood' ? 'Understood' : node.status === 'learning' ? 'Learning' : 'Next'}
                    </span>
                    {node.facts.length > 0 ? (
                      <span className="guest-q-node-facts">
                        {node.facts.slice(0, 1).map((fact) => (
                          <i key={fact}>{fact}</i>
                        ))}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="guest-q-insight">
              <Lightbulb size={17} aria-hidden="true" />
              <div>
                <p className="guest-q-insight-title">
                  {reviewReady ? 'Workspace prepared.' : dnaActive ? DNA_INSIGHT[dnaActive] : 'Q is ready when you are.'}
                </p>
                <p className="guest-q-insight-body">
                  {reviewReady
                    ? 'Review what Q learned.'
                    : 'This helps me tailor the right workflow and prepare the right workspace.'}
                </p>
              </div>
            </div>

            <div className="guest-q-setup">
              <div className="guest-q-section-title">Setup progress</div>
              <div className="guest-q-setup-row">
                <span className="guest-q-setup-count">{`${setupProgress.done} of ${setupProgress.total}`}</span>
                <span className="guest-q-setup-rail" aria-hidden="true">
                  {Array.from({ length: setupProgress.total }, (_, index) => (
                    <i key={index} className={index < setupProgress.done ? 'is-done' : ''} />
                  ))}
                </span>
              </div>
            </div>

            <div className="guest-q-dna-principle">Q learns. Q prepares. You decide.</div>

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
