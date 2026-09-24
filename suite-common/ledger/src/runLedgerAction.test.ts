import {
    DeviceActionStatus,
    type ExecuteDeviceActionReturnType,
} from '@ledgerhq/device-management-kit';
import { of } from 'rxjs';

import { runLedgerAction } from './runLedgerAction';

type TestAction = ExecuteDeviceActionReturnType<string, Error, { requiredUserInteraction: string }>;

describe('runLedgerAction', () => {
    it('returns the completed result after a pending update', async () => {
        const action: TestAction = {
            observable: of(
                {
                    status: DeviceActionStatus.Pending as const,
                    intermediateValue: { requiredUserInteraction: 'verify-address' },
                },
                { status: DeviceActionStatus.Completed as const, output: 'address' },
            ),
            cancel: jest.fn(),
        };

        await expect(runLedgerAction(action)).resolves.toBe('address');
        expect(action.cancel).not.toHaveBeenCalled();
    });

    it('propagates signer errors', async () => {
        const error = new Error('Device rejected request');
        const action: TestAction = {
            observable: of({ status: DeviceActionStatus.Error, error }),
            cancel: jest.fn(),
        };

        await expect(runLedgerAction(action)).rejects.toBe(error);
    });

    it('does not report a stopped action as success', async () => {
        const action: TestAction = {
            observable: of({ status: DeviceActionStatus.Stopped }),
            cancel: jest.fn(),
        };

        await expect(runLedgerAction(action)).rejects.toThrow('Ledger action stopped');
    });
});
