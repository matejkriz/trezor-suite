import { Translation } from '@suite/intl';
import { selectSelectedDevice, selectSelectedExternalWallet } from '@suite-common/device';
import { type SerializedTx } from '@suite-common/wallet-core';
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
    const externalWallet = useSelector(selectSelectedExternalWallet);
    const deviceModelInternal = device?.features?.internal_model;
    let activeStep = getActiveStep({ totalSteps, serializedTx, reviewStep });
    if (externalWallet) activeStep = serializedTx ? 2 : 1;

    return (
        <ConfirmOnDevicePill
            title={externalWallet ? 'Confirm on Ledger' : <Translation id="TR_CONFIRM_ON_TREZOR" />}
            steps={externalWallet ? 1 : totalSteps}
            activeStep={activeStep}
            deviceModelInternal={deviceModelInternal}
            deviceUnitColor={device?.features?.unit_color}
            successText={<Translation id="TR_CONFIRMED_TX" />}
            onCancel={isSending ? undefined : onCancel}
        />
    );
};
