export const getLedgerConnectionErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error !== 'object' || error === null || !('_tag' in error)) {
        return 'Ledger connection failed';
    }

    if (error._tag === 'WebHidTransportNotSupportedError') {
        return 'USB connection to Ledger requires WebHID. Open Suite in Chrome or Edge, or use the desktop app.';
    }

    if (error._tag === 'NoAccessibleDeviceError') {
        return 'No Ledger was selected in the USB device picker. Connect it by USB and try again.';
    }

    if ('message' in error && typeof error.message === 'string' && error.message) {
        return error.message;
    }

    if (
        'originalError' in error &&
        error.originalError instanceof Error &&
        error.originalError.message
    ) {
        return error.originalError.message;
    }

    return 'Ledger connection failed';
};
