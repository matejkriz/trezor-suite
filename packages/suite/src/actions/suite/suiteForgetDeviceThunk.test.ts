import { mockForgetBluetoothDevice } from '@suite-common/bluetooth/mocks';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { createTestCompositionRoot } from '@suite-common/test-utils';
import { forgetDeviceThunk } from '@suite-common/wallet-core';

import { suiteForgetDeviceThunk } from './suiteForgetDeviceThunk';
import { createInMemoryDbMock } from '../../../mocks/createInMemoryDbMock';
import { mockInitialAppState } from '../../../mocks/mockInitialAppState';

jest.mock('@suite-common/wallet-core', () => ({
    ...jest.requireActual('@suite-common/wallet-core'),
    forgetDeviceThunk: jest.fn(),
}));

describe('forget an explicitly chosen device', () => {
    it('does not forget a newly selected wallet when the original device is already gone', async () => {
        const selectedDevice = mockSuiteDevice({ id: 'another-wallet' });
        const root = createTestCompositionRoot({
            extra: {
                services: {
                    db: createInMemoryDbMock({ dispatch: jest.fn(), reloadApp: jest.fn() }),
                },
                thunks: { forgetBluetoothDevice: mockForgetBluetoothDevice() },
            },
            preloadedState: {
                ...mockInitialAppState,
                device: {
                    ...mockInitialAppState.device,
                    devices: [selectedDevice],
                    selectedDevice,
                },
            },
        });

        const result = await root.store.dispatch(
            suiteForgetDeviceThunk({ deviceId: 'original-wallet' }),
        );

        expect(result.type).toBe(suiteForgetDeviceThunk.fulfilled.type);
        expect(forgetDeviceThunk).not.toHaveBeenCalled();
    });
});
