type LogoMarkProps = {
    size?: number;
};

type LogoFullProps = {
    height?: number;
};

type LogoAppProps = {
    size?: number;
};

export const LogoMark = ({ size = 32 }: LogoMarkProps) => (
    <img
        src="/brand/q360-mark.png"
        alt="Q360"
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
    />
);

export const LogoFull = ({ height = 28 }: LogoFullProps) => (
    <img
        src="/brand/q360-logo.png"
        alt="Q360 by Qamar Technologies"
        width={height * (8 / 3)}
        height={height}
        style={{ display: 'block', objectFit: 'contain' }}
    />
);

export const LogoApp = ({ size = 48 }: LogoAppProps) => (
    <img
        src="/brand/q360-app-icon.png"
        alt="Q360"
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
    />
);
