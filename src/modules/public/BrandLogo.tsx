/**
 * Official Q360 master logo — production assets (CTO Architecture, founder-approved).
 * Serves /brand/q360-logo.svg on light backgrounds and /brand/q360-logo-dark.svg
 * on dark. Single branding reference for all public surfaces; do not edit the
 * asset files — replace them to update the brand.
 */
export const BrandLogo = ({
    height = 30,
    theme = 'light',
    className,
}: {
    height?: number;
    theme?: 'light' | 'dark';
    className?: string;
}) => (
    <img
        className={className}
        src={theme === 'dark' ? '/brand/q360-logo-dark.svg' : '/brand/q360-logo.svg'}
        alt="Q360"
        style={{ display: 'block', height, width: 'auto' }}
    />
);
