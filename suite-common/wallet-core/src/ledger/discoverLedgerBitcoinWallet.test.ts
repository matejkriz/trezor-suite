import { type LedgerDevice } from '@suite-common/ledger';
import { type AccountInfo } from '@trezor/connect';

import { discoverLedgerBitcoinWallet } from './discoverLedgerBitcoinWallet';

const device = { id: 'transient-webhid-id', name: 'Ledger Flex' } as LedgerDevice;

const ledgerAccount = (index: number) => ({
    path: `84'/0'/${index}'`,
    extendedPublicKey: `xpub-${index}`,
    descriptor: `zpub-${index}`,
    masterFingerprint: '1234abcd',
    address: `bc1qaddress${index}`,
});

const accountInfo = (index: number, empty: boolean): AccountInfo =>
    ({
        descriptor: `zpub-${index}`,
        empty,
        balance: '0',
        availableBalance: '0',
        history: { total: 0, unconfirmed: 0 },
        utxo: [],
        tokens: [],
        addresses: { used: [], unused: [], change: [] },
    }) as AccountInfo;

describe('discoverLedgerBitcoinWallet', () => {
    it('binds Bitcoin accounts to a stable descriptor-based wallet identity', async () => {
        const service = {
            connect: jest.fn().mockResolvedValue(undefined),
            isConnectionOwner: jest.fn(() => true),
            getDeviceInfo: jest.fn().mockReturnValue({
                name: 'My Ledger',
                model: 'Ledger Flex',
                osVersion: '1.3.0',
                bitcoinAppVersion: '2.4.0',
            }),
            getAccount: jest.fn().mockResolvedValue(ledgerAccount(0)),
        };
        const getAccountInfo = jest.fn().mockResolvedValue({
            success: true,
            payload: accountInfo(0, true),
        });

        const result = await discoverLedgerBitcoinWallet(
            { ledgerBitcoinService: service, getAccountInfo },
            device,
            { owner: 'acquisition-a' },
        );

        expect(service.connect).toHaveBeenCalledWith(device, { owner: 'acquisition-a' });
        expect(getAccountInfo).toHaveBeenCalledWith('zpub-0');
        expect(result.wallet.id).not.toContain(device.id);
        expect(result.wallet.staticSessionId).toContain('@ledger:0');
        expect(result.wallet.sessionId).toBe('acquisition-a');
        expect(result.wallet.label).toBe('My Ledger');
        expect(result.wallet.deviceInfo).toEqual(service.getDeviceInfo());
        expect(result.accounts).toEqual([
            {
                index: 0,
                path: "m/84'/0'/0'",
                accountInfo: accountInfo(0, true),
                visible: true,
            },
        ]);
    });

    it('discovers used accounts until the first empty account', async () => {
        const service = {
            connect: jest.fn().mockResolvedValue(undefined),
            isConnectionOwner: jest.fn(() => true),
            getDeviceInfo: jest.fn().mockReturnValue(undefined),
            getAccount: jest.fn(index => Promise.resolve(ledgerAccount(index))),
        };
        const getAccountInfo = jest.fn(descriptor =>
            Promise.resolve({
                success: true as const,
                payload: accountInfo(Number(descriptor.slice(-1)), descriptor.endsWith('1')),
            }),
        );

        const result = await discoverLedgerBitcoinWallet(
            { ledgerBitcoinService: service, getAccountInfo },
            device,
        );

        expect(service.getAccount).toHaveBeenCalledTimes(2);
        expect(result.accounts).toHaveLength(2);
        expect(result.accounts[0]?.visible).toBe(true);
        expect(result.accounts[1]?.visible).toBe(false);
        expect(result.wallet.label).toBe('Ledger');
    });

    it('does not expose a wallet when the backend query fails', async () => {
        const service = {
            connect: jest.fn().mockResolvedValue(undefined),
            isConnectionOwner: jest.fn(() => true),
            getDeviceInfo: jest.fn().mockReturnValue(undefined),
            getAccount: jest.fn().mockResolvedValue(ledgerAccount(0)),
        };
        const getAccountInfo = jest.fn().mockResolvedValue({
            success: false,
            error: { message: 'Backend unavailable' },
        });

        await expect(
            discoverLedgerBitcoinWallet({ ledgerBitcoinService: service, getAccountInfo }, device),
        ).rejects.toThrow('Backend unavailable');
    });
});
