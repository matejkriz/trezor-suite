import { AnimationCard } from './AnimationCard';

export const LedgerConnectionIllustration = () => (
    <AnimationCard aspectRatio="1 / 1" maxHeight="38vh">
        <svg
            role="img"
            aria-label="Generic USB hardware wallet illustration"
            width="100%"
            height="100%"
            viewBox="0 0 400 400"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="walletBody" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#363F4B" />
                    <stop offset="1" stopColor="#161C25" />
                </linearGradient>
                <linearGradient id="walletMetal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#D8DFE5" />
                    <stop offset="1" stopColor="#858E9A" />
                </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="156" fill="#E4ECE9" />
            <circle cx="200" cy="200" r="116" fill="#D5E5DE" />
            <g transform="rotate(-28 200 200)">
                <rect x="80" y="151" width="240" height="100" rx="22" fill="url(#walletBody)" />
                <rect x="106" y="170" width="145" height="62" rx="8" fill="#A7CFBD" />
                <rect x="119" y="182" width="91" height="7" rx="3.5" fill="#376B58" />
                <rect x="119" y="197" width="69" height="7" rx="3.5" fill="#558773" />
                <circle cx="286" cy="201" r="13" fill="#74818C" />
                <rect x="317" y="178" width="35" height="46" rx="9" fill="url(#walletMetal)" />
                <rect x="344" y="186" width="12" height="30" rx="5" fill="#5E6A74" />
            </g>
        </svg>
    </AnimationCard>
);
