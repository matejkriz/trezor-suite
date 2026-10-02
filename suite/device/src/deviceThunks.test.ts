import { createMockDispatch } from '@suite-common/redux-utils/mocks';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';

import { openConnectionModal, setConnectionMode } from './deviceSlice';
import { openDeviceConnectionThunk } from './deviceThunks';

describe('open device connection', () => {
    it.each(['trezor', 'ledger'] as const)(
        'reconnects %s with its connection protocol',
        async provider => {
            const device = {
                ...mockSuiteDevice({ descriptor: { apiType: 'bluetooth', id: 'test-device' } }),
                provider,
            };
            const { dispatch, actions } = createMockDispatch({ getState: () => ({}), extra: {} });

            await openDeviceConnectionThunk(device)(dispatch, () => ({}), {});

            expect(actions).toContainEqual(setConnectionMode('bluetooth'));
            expect(actions).toContainEqual(openConnectionModal(provider));
        },
    );

    it('resets Bluetooth mode for a subsequent USB connection', async () => {
        const { dispatch, actions } = createMockDispatch({ getState: () => ({}), extra: {} });

        await openDeviceConnectionThunk(mockSuiteDevice())(dispatch, () => ({}), {});

        expect(actions).toContainEqual(setConnectionMode('cable'));
        expect(actions).toContainEqual(openConnectionModal('trezor'));
    });
});
