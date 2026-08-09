/**
 * Official Q360 master logo — horizontal lockup, drawn as pure vector strokes from
 * the approved brand board: circular Q ("complete view / intelligence") in the
 * current text color, Momentum Orange tail (#FF6A00 in both light and dark usage),
 * monoline rounded "360". Single swap point: replace this component's markup with
 * the production SVG file's content when design delivers it.
 */
export const BrandLogo = ({ height = 30, className }: { height?: number; className?: string }) => (
    <svg
        className={className}
        viewBox="0 0 184 64"
        role="img"
        aria-label="Q360"
        style={{ display: 'block', height, width: 'auto' }}
    >
        <circle
            cx="32"
            cy="32"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="5.2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="86 14"
        />
        <path d="M40 40 L56 56" stroke="#FF6A00" strokeWidth="6" strokeLinecap="round" />
        <circle
            cx="90"
            cy="19"
            r="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="5.2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="75 25"
            strokeDashoffset="-62.5"
        />
        <circle
            cx="90"
            cy="43"
            r="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="5.2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="75 25"
            strokeDashoffset="-62.5"
        />
        <circle
            cx="126"
            cy="43"
            r="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="5.2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="75 25"
            strokeDashoffset="-62.5"
        />
        <path d="M128 8 A 20 20 0 0 0 113 35" fill="none" stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" />
        <rect x="150" y="8" width="24" height="48" rx="12" fill="none" stroke="currentColor" strokeWidth="5.2" />
    </svg>
);
