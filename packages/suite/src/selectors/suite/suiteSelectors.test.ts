import { selectPrerequisite } from './suiteSelectors';

const wallet = {
    id: 'ledgerwallet',
    provider: 'ledger' as const,
    label: 'Ledger Flex',
    staticSessionId: 'ledgerwallet@ledger:0' as const,
    connected: true,
};

describe('selectPrerequisite', () => {
    const getState = (selectedExternalWalletId?: string) =>
        ({
            suite: { transport: undefined },
            router: { app: 'wallet', route: { name: 'wallet-index' } },
            device: {
                selectedDevice: undefined,
                externalWallets: [wallet],
                selectedExternalWalletId,
            },
        }) as unknown as Parameters<typeof selectPrerequisite>[0];

    it('allows wallet pages for a selected Ledger', () => {
        expect(selectPrerequisite(getState(wallet.id))).toBeNull();
    });

    it('still requires a device when no wallet is selected', () => {
        expect(selectPrerequisite(getState())).toBe('device-disconnected');
    });
});
