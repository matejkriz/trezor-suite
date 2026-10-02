import { getLedgerConnectionErrorMessage } from './getLedgerConnectionErrorMessage';

describe('getLedgerConnectionErrorMessage', () => {
    it('explains when WebHID is unavailable', () => {
        expect(
            getLedgerConnectionErrorMessage({
                _tag: 'WebHidTransportNotSupportedError',
                originalError: new Error('WebHID not supported'),
            }),
        ).toContain('Chrome or Edge');
    });

    it('explains a canceled USB device picker', () => {
        expect(
            getLedgerConnectionErrorMessage({
                _tag: 'NoAccessibleDeviceError',
                originalError: new Error('No selected device'),
            }),
        ).toContain('No Ledger was selected');
    });

    it('preserves the message in an SDK error without a dedicated explanation', () => {
        expect(
            getLedgerConnectionErrorMessage({
                _tag: 'UnknownDeviceExchangeError',
                message: 'Open the Bitcoin app',
            }),
        ).toBe('Open the Bitcoin app');
    });

    it('preserves a regular error message', () => {
        expect(getLedgerConnectionErrorMessage(new Error('USB disconnected'))).toBe(
            'USB disconnected',
        );
    });
});
