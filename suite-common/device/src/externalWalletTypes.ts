import { type StaticSessionId } from '@trezor/connect';

export type ExternalWallet = {
    id: string;
    provider: 'ledger';
    label: string;
    staticSessionId: StaticSessionId;
    connected: boolean;
};
