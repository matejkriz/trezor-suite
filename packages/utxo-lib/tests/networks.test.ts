import * as networks from '../src/networks';

const { isNetworkType } = networks;

describe('networks', () => {
    it('dash', () => {
        expect(isNetworkType('dash', networks.dash)).toBe(true);
        expect(isNetworkType('dash', networks.dashTest)).toBe(true);
        expect(isNetworkType('dash', networks.bitcoin)).toBe(false);
    });

    it('decred', () => {
        expect(isNetworkType('decred', networks.decred)).toBe(true);
        expect(isNetworkType('decred', networks.decredSim)).toBe(true);
        expect(isNetworkType('decred', networks.decredTest)).toBe(true);
        expect(isNetworkType('decred', networks.bitcoin)).toBe(false);
    });

    it('komodo', () => {
        expect(isNetworkType('komodo', networks.komodo)).toBe(true);
    });

    it('zcash', () => {
        expect(isNetworkType('zcash', networks.zcash)).toBe(true);
        expect(isNetworkType('zcash', networks.zcashTest)).toBe(true);
        expect(isNetworkType('zcash', networks.bitcoin)).toBe(false);
    });

    it('zcashType', () => {
        expect(isNetworkType('zcashType', networks.zcash)).toBe(true);
        expect(isNetworkType('zcashType', networks.zcashTest)).toBe(true);
        expect(isNetworkType('komodo', networks.komodo)).toBe(true);
        expect(isNetworkType('zcashType', networks.bitcoin)).toBe(false);
    });
});
