import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop, type SvgProps } from 'react-native-svg';

export const HardwareWalletSvg = (props: SvgProps) => (
    <Svg viewBox="0 0 400 400" accessibilityLabel="Hardware wallet" {...props}>
        <Defs>
            <LinearGradient id="walletBody" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#363F4B" />
                <Stop offset="1" stopColor="#161C25" />
            </LinearGradient>
            <LinearGradient id="walletMetal" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#D8DFE5" />
                <Stop offset="1" stopColor="#858E9A" />
            </LinearGradient>
        </Defs>
        <Circle cx="200" cy="200" r="156" fill="#E4ECE9" />
        <Circle cx="200" cy="200" r="116" fill="#D5E5DE" />
        <G transform="rotate(-28 200 200)">
            <Rect x="80" y="151" width="240" height="100" rx="22" fill="url(#walletBody)" />
            <Rect x="106" y="170" width="145" height="62" rx="8" fill="#A7CFBD" />
            <Rect x="119" y="182" width="91" height="7" rx="3.5" fill="#376B58" />
            <Rect x="119" y="197" width="69" height="7" rx="3.5" fill="#558773" />
            <Circle cx="286" cy="201" r="13" fill="#74818C" />
            <Rect x="317" y="178" width="35" height="46" rx="9" fill="url(#walletMetal)" />
            <Rect x="344" y="186" width="12" height="30" rx="5" fill="#5E6A74" />
        </G>
    </Svg>
);
