import { restoreLegacyLedgerDevices } from './restoreLegacyLedgerDevices';

const wallet = {
    id: 'ledger-wallet',
    provider: 'ledger' as const,
    label: 'Ledger Flex',
    staticSessionId: 'ledger-wallet@ledger:0' as const,
    connected: true,
};

describe(restoreLegacyLedgerDevices.name, () => {
    it('moves a wallet from the former externalWallets storage into disconnected devices', () => {
        const devices = restoreLegacyLedgerDevices(new Set(), [wallet]);

        expect(devices).toHaveLength(1);
        expect(devices[0]).toMatchObject({
            provider: 'ledger',
            id: wallet.id,
            name: wallet.label,
            connected: false,
            remember: true,
            state: { staticSessionId: wallet.staticSessionId },
        });
    });

    it('does not duplicate a Ledger already saved in devices', () => {
        expect(restoreLegacyLedgerDevices(new Set([wallet.id]), [wallet])).toEqual([]);
    });
});
