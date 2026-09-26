export class WalletDeviceActionError extends Error {
    constructor(readonly kind: 'cancelled' | 'rejected' | 'timeout') {
        super(`Device action ${kind}`);
        this.name = 'WalletDeviceActionError';
    }
}
