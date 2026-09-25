import { type StaticSessionId } from '@trezor/connect';

export type LegacyExternalWallet = {
    id: string;
    provider: 'ledger';
    label: string;
    staticSessionId: StaticSessionId;
    connected: boolean;
};
