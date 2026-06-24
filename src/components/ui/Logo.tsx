type LogoMarkProps = {
    size?: number;
};

type LogoFullProps = {
    height?: number;
};

type LogoAppProps = {
    size?: number;
};

const MarkPaths = ({ stroke }: { stroke: string }) => (
    <>
        <circle
            cx="32"
            cy="32"
            r="24"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="132 19"
            transform="rotate(42 32 32)"
        />
        <circle
            cx="32"
            cy="32"
            r="16"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="88 13"
            transform="rotate(42 32 32)"
        />
        <path d="M42.5 42.5 56 56" stroke={stroke} strokeWidth="3" strokeLinecap="square" />
    </>
);

export const LogoMark = ({ size = 32 }: LogoMarkProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Q360"
    >
        <MarkPaths stroke="#0a0a0a" />
    </svg>
);

export const LogoFull = ({ height = 28 }: LogoFullProps) => (
    <svg
        width={height * 3.25}
        height={height}
        viewBox="0 0 208 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Q360"
    >
        <MarkPaths stroke="#0a0a0a" />
        <text
            x="72"
            y="47"
            fill="#0a0a0a"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="47"
            fontWeight="700"
            letterSpacing="-2"
        >
            360
        </text>
    </svg>
);

export const LogoApp = ({ size = 48 }: LogoAppProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Q360"
    >
        <rect width="64" height="64" rx="14" fill="#0a0a0a" />
        <g transform="translate(8 8) scale(.75)">
            <MarkPaths stroke="#ffffff" />
        </g>
    </svg>
);
