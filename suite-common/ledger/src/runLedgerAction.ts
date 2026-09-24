import {
    DeviceActionStatus,
    type ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';
import { filter, firstValueFrom } from 'rxjs';

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
        throw terminalState.error;
    }

    throw new Error('Ledger action stopped');
};
