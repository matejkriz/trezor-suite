import { deviceReducerInitialState } from '@suite-common/device';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import { getTranslation } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';
import { renderWithStoreProvider, userEvent } from '@suite-native/test-utils-store';

import { ReceiveAddressVerificationBottomSheet } from './ReceiveAddressVerificationBottomSheet';

describe('ReceiveAddressVerificationBottomSheet', () => {
    const onVerifyAddress = jest.fn();
    const onSkipVerification = jest.fn();

    const renderBottomSheet = async (
        source: ReceiveAddressVerificationSource = ReceiveAddressVerificationSource.Pasted,
        isLedger = false,
    ) =>
        await renderWithStoreProvider(
            <ReceiveAddressVerificationBottomSheet
                ref={{ current: null }}
                source={source}
                onVerifyAddress={onVerifyAddress}
                onSkipVerification={onSkipVerification}
            />,
            {
                preloadedState: {
                    device: {
                        ...deviceReducerInitialState,
                        selectedDevice: isLedger
                            ? { ...mockSuiteDevice(), provider: 'ledger' as const }
                            : undefined,
                    },
                },
            },
        );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders shared address instructions', async () => {
        const { getByText, queryByText } = await renderBottomSheet(
            ReceiveAddressVerificationSource.Shared,
        );

        expect(
            getByText(getTranslation('moduleReceive.addressSharedBottomSheet.title')),
        ).toBeOnTheScreen();
        expect(
            getByText(getTranslation('moduleReceive.addressSharedBottomSheet.subtitle')),
        ).toBeOnTheScreen();
        expect(
            queryByText(
                getTranslation('moduleReceive.addressCopiedBottomSheet.steps.pasteAddress'),
            ),
        ).not.toBeOnTheScreen();
    });

    it('renders verification instructions', async () => {
        const { getByText } = await renderBottomSheet();

        expect(
            getByText(getTranslation('moduleReceive.addressCopiedBottomSheet.title')),
        ).toBeOnTheScreen();
        expect(
            getByText(getTranslation('moduleReceive.addressCopiedBottomSheet.subtitle')),
        ).toBeOnTheScreen();
        expect(
            getByText(getTranslation('moduleReceive.addressCopiedBottomSheet.steps.pasteAddress')),
        ).toBeOnTheScreen();
        expect(
            getByText(getTranslation('moduleReceive.addressCopiedBottomSheet.steps.verifyAddress')),
        ).toBeOnTheScreen();
    });

    it('calls verification action', async () => {
        const { getByText } = await renderBottomSheet();

        await userEvent.press(
            getByText(
                getTranslation('moduleReceive.addressCopiedBottomSheet.buttons.verifyOnTrezor'),
            ),
        );

        expect(onVerifyAddress).toHaveBeenCalledTimes(1);
    });

    it('calls skip action', async () => {
        const { getByText } = await renderBottomSheet();

        await userEvent.press(
            getByText(
                getTranslation('moduleReceive.addressCopiedBottomSheet.buttons.skipVerification'),
            ),
        );

        expect(onSkipVerification).toHaveBeenCalledTimes(1);
    });

    it('uses Ledger verification instructions and keeps the same verify action', async () => {
        const { getByText, queryByText } = await renderBottomSheet(
            ReceiveAddressVerificationSource.Pasted,
            true,
        );

        expect(
            getByText(
                getTranslation(
                    'moduleReceive.addressCopiedBottomSheet.steps.verifyAddressOnDevice',
                    { deviceName: 'Ledger' },
                ),
            ),
        ).toBeOnTheScreen();
        expect(
            queryByText(
                getTranslation('moduleReceive.addressCopiedBottomSheet.buttons.verifyOnTrezor'),
            ),
        ).not.toBeOnTheScreen();
        await userEvent.press(
            getByText(
                getTranslation('moduleReceive.addressCopiedBottomSheet.buttons.verifyOnDevice', {
                    deviceName: 'Ledger',
                }),
            ),
        );

        expect(onVerifyAddress).toHaveBeenCalledTimes(1);
    });
});
