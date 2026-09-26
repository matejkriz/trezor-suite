import { renderWithBasicProvider } from '@suite-native/test-utils';
import { DeviceModelInternal } from '@trezor/device-utils';

import { DeviceImage } from './DeviceImage';

describe('DeviceImage', () => {
    it('shows the hardware wallet artwork for Ledger instead of a Trezor model', async () => {
        const { getByLabelText, getByTestId } = await renderWithBasicProvider(
            <DeviceImage
                deviceModel={DeviceModelInternal.UNKNOWN}
                deviceImage="ledger"
                size="large"
                maxHeight={200}
            />,
        );

        expect(getByLabelText('Hardware wallet')).toBeOnTheScreen();
        expect(getByTestId('@device/image').props.height).toBe(200);
    });

    it('keeps the existing Trezor image by default', async () => {
        const { queryByLabelText, getByTestId } = await renderWithBasicProvider(
            <DeviceImage deviceModel={DeviceModelInternal.T3B1} />,
        );

        expect(queryByLabelText('Hardware wallet')).not.toBeOnTheScreen();
        expect(getByTestId('@device/image')).toBeOnTheScreen();
    });
});
