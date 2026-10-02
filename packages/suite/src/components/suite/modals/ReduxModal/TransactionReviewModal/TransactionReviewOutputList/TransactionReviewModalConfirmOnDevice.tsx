import { Translation } from '@suite/intl';
import { useServices } from '@suite-common/dependency-injection';
import { selectDeviceBrandName, selectSelectedDevice } from '@suite-common/device';
import { type SerializedTx, injectWalletDeviceService } from '@suite-common/wallet-core';
import { ConfirmOnDevicePill } from '@trezor/product-components';

import { useSelector } from 'src/hooks/suite';

interface GetActiveStepProps {
    totalSteps: number | undefined;
    serializedTx: SerializedTx | undefined;
    reviewStep: number;
}

const getActiveStep = ({ totalSteps, serializedTx, reviewStep }: GetActiveStepProps) => {
    if (totalSteps === undefined) return undefined;

    if (serializedTx) return totalSteps + 1;

    // adjust for 0-based index
    const offsetReviewStep = reviewStep + 1;

    return Math.min(offsetReviewStep, totalSteps);
};

interface TransactionReviewModalConfirmOnDeviceProps {
    totalSteps: number | undefined;
    serializedTx: SerializedTx | undefined;
    isSending: boolean;
    reviewStep: number;
    onCancel: () => void;
}

export const TransactionReviewModalConfirmOnDevice = ({
    totalSteps,
    serializedTx,
    isSending,
    reviewStep,
    onCancel,
}: TransactionReviewModalConfirmOnDeviceProps) => {
    const device = useSelector(selectSelectedDevice);
    const deviceBrand = useSelector(selectDeviceBrandName);
    const { walletDeviceService } = useServices(injectWalletDeviceService);
    const steps = (device && walletDeviceService.get(device)?.transactionReviewSteps) ?? totalSteps;
    const deviceModelInternal = device?.features?.internal_model;
    const activeStep = getActiveStep({ totalSteps: steps, serializedTx, reviewStep });

    return (
        <ConfirmOnDevicePill
            title={<Translation id="TR_CONFIRM_ON_DEVICE" values={{ deviceBrand }} />}
            steps={steps}
            activeStep={activeStep}
            deviceModelInternal={deviceModelInternal}
            deviceUnitColor={device?.features?.unit_color}
            successText={<Translation id="TR_CONFIRMED_TX" />}
            onCancel={isSending ? undefined : onCancel}
        />
    );
};
