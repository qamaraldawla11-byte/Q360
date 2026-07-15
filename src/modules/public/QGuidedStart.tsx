import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';

type QGuidedStartProps = {
    onStart: () => void;
    onExplore: () => void;
};

export const QGuidedStart = ({ onStart, onExplore }: QGuidedStartProps) => (
    <aside className="q-guided-start" aria-label="Start your Q360 setup with Q">
        <div className="q-guided-start__glow" aria-hidden="true" />
        <div className="q-guided-start__header">
            <span className="q-guided-start__mark"><img src="/brand/q360-mark.svg" alt="Q" /></span>
            <span>
                <strong>Q guided setup</strong>
                <small>Start with a simple conversation</small>
            </span>
            <Sparkles className="q-guided-start__sparkle" size={18} aria-hidden="true" />
        </div>

        <div className="q-guided-start__conversation">
            <p className="q-guided-start__user">I have a restaurant with 4 tables and takeaway.</p>
            <p className="q-guided-start__reply">
                Great. I’ll help you choose the right setup, then you stay in control of every decision.
            </p>
        </div>

        <div className="q-guided-start__actions">
            <button type="button" className="q-guided-start__primary" onClick={onStart}>
                <MessageCircle size={17} /> Start with Q <ArrowRight size={17} />
            </button>
            <button type="button" className="q-guided-start__secondary" onClick={onExplore}>
                Explore workspaces
            </button>
        </div>
        <p className="q-guided-start__note">Sign in to begin. Q recommends a setup; it never makes changes without you.</p>

        <style>{`
            .q-guided-start {
                position: relative;
                max-width: 760px;
                margin: 42px auto 0;
                padding: 22px;
                overflow: hidden;
                color: #eaf3ff;
                background: linear-gradient(135deg, rgba(17, 43, 77, 0.98), rgba(11, 24, 45, 0.98));
                border: 1px solid rgba(104, 183, 255, 0.35);
                border-radius: 18px;
                box-shadow: 0 24px 54px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08);
            }
            .q-guided-start__glow {
                position: absolute;
                width: 250px;
                height: 250px;
                top: -130px;
                right: -70px;
                border-radius: 50%;
                background: rgba(45, 158, 255, 0.2);
                filter: blur(18px);
                pointer-events: none;
            }
            .q-guided-start__header, .q-guided-start__actions {
                position: relative;
                display: flex;
                align-items: center;
            }
            .q-guided-start__header { gap: 11px; }
            .q-guided-start__header strong, .q-guided-start__header small { display: block; }
            .q-guided-start__header strong { font-size: 14px; letter-spacing: .02em; }
            .q-guided-start__header small { margin-top: 2px; color: #a9c4e8; font-size: 12px; }
            .q-guided-start__mark {
                display: grid;
                width: 42px;
                height: 42px;
                place-items: center;
                background: rgba(126, 209, 255, 0.13);
                border: 1px solid rgba(126, 209, 255, 0.25);
                border-radius: 12px;
            }
            .q-guided-start__mark img { width: 30px; height: 30px; object-fit: contain; }
            .q-guided-start__sparkle { margin-left: auto; color: #87d7ff; }
            .q-guided-start__conversation { position: relative; display: grid; gap: 10px; margin: 22px 0; }
            .q-guided-start__conversation p { margin: 0; padding: 12px 14px; border-radius: 12px; font-size: 14px; line-height: 1.45; }
            .q-guided-start__user { justify-self: end; max-width: 82%; background: #0d75ad; color: white; }
            .q-guided-start__reply { max-width: 88%; background: rgba(255, 255, 255, 0.08); color: #d8e9fc; border: 1px solid rgba(255, 255, 255, 0.1); }
            .q-guided-start__actions { gap: 10px; flex-wrap: wrap; }
            .q-guided-start__primary, .q-guided-start__secondary {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 42px;
                padding: 0 16px;
                border-radius: 10px;
                font: inherit;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
            }
            .q-guided-start__primary { color: #062039; background: #a9e2ff; border: 1px solid #a9e2ff; }
            .q-guided-start__secondary { color: #dbeafe; background: transparent; border: 1px solid rgba(211, 231, 255, .36); }
            .q-guided-start__primary:hover { background: #d5f1ff; }
            .q-guided-start__secondary:hover { background: rgba(255, 255, 255, .08); }
            .q-guided-start__note { position: relative; margin: 14px 0 0; color: #9db5d4; font-size: 12px; line-height: 1.45; }
            .landing-page[data-theme='light'] .q-guided-start {
                color: #f8fbff;
                background: linear-gradient(135deg, #113b71, #0b2447);
                border-color: rgba(23, 105, 224, 0.42);
                box-shadow: 0 26px 54px rgba(35, 85, 149, .2), inset 0 1px 0 rgba(255, 255, 255, .12);
            }
            .landing-page[data-theme='light'] .q-guided-start__secondary { color: #eaf4ff; }
            @media (max-width: 640px) {
                .q-guided-start { margin-top: 28px; padding: 16px; border-radius: 14px; }
                .q-guided-start__conversation { margin: 18px 0; }
                .q-guided-start__user, .q-guided-start__reply { max-width: 100%; }
                .q-guided-start__actions { display: grid; grid-template-columns: 1fr; }
            }
        `}</style>
    </aside>
);
