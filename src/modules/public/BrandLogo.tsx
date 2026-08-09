/**
 * Official Q360 master logo — horizontal lockup, recreated as inline SVG from the
 * approved brand board: circular Q stroke ("complete view / intelligence") in the
 * current text color, with the Momentum Orange tail ("action / momentum") that
 * stays #FF6A00 in both light and dark usage. Swap for the master asset file when
 * design supplies it.
 */
export const BrandLogo = ({ height = 30, className }: { height?: number; className?: string }) => (
    <svg
        className={className}
        viewBox="0 0 142 56"
        role="img"
        aria-label="Q360"
        style={{ display: 'block', height, width: 'auto' }}
    >
        <circle
            cx="26"
            cy="26"
            r="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="6.5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="85 15"
        />
        <path d="M35 35 L48 48" stroke="#FF6A00" strokeWidth="6.5" strokeLinecap="round" />
        <text
            x="60"
            y="40"
            fill="currentColor"
            fontSize="35"
            fontWeight="700"
            letterSpacing="1"
            fontFamily="Satoshi,'Arial Rounded MT Bold','Segoe UI Rounded',Inter,system-ui,sans-serif"
        >
            360
        </text>
    </svg>
);
