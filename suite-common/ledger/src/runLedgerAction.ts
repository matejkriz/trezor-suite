import {
    DeviceActionStatus,
    type ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';
import { filter, firstValueFrom } from 'rxjs';

export type LedgerActionErrorKind = 'cancelled' | 'rejected' | 'timeout';

export class LedgerActionError extends Error {
    constructor(readonly kind: LedgerActionErrorKind) {
        super(`Ledger action ${kind}`);
        this.name = 'LedgerActionError';
    }
}

export const runLedgerAction = async <Output, ActionError, IntermediateValue>(
    action: ExecuteDeviceActionReturnType<Output, ActionError, IntermediateValue>,
): Promise<Output> => {
    const terminalState = await firstValueFrom(
        action.observable.pipe(
            filter(state =>
                [
                    DeviceActionStatus.Completed,
                    DeviceActionStatus.Error,
                    DeviceActionStatus.Stopped,
                ].includes(state.status),
            ),
        ),
    );

    if (terminalState.status === DeviceActionStatus.Completed) {
        return terminalState.output;
    }

    if (terminalState.status === DeviceActionStatus.Error) {
        const { error } = terminalState;
        if (typeof error === 'object' && error !== null) {
            if (
                '_tag' in error &&
                (error._tag === 'SendApduTimeoutError' || error._tag === 'SendCommandTimeoutError')
            ) {
                throw new LedgerActionError('timeout');
            }
            if (
                ('_tag' in error && error._tag === 'RefusedByUserDAError') ||
                ('errorCode' in error && error.errorCode === '6985')
            ) {
                throw new LedgerActionError('rejected');
            }
        }
        throw terminalState.error;
    }

    throw new LedgerActionError('cancelled');
};
