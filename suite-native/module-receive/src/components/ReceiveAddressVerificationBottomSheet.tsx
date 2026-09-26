import { useSelector } from 'react-redux';

import { selectDeviceBrandName } from '@suite-common/device';
import {
    BottomSheetModal,
    type BottomSheetModalRef,
    Button,
    IconList,
    IconListTextItem,
    Text,
    VStack,
} from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import { ReceiveAddressVerificationSource } from '@suite-native/navigation';

type ReceiveAddressVerificationBottomSheetProps = {
    ref: BottomSheetModalRef;
    source: ReceiveAddressVerificationSource;
    onVerifyAddress: () => void;
    onSkipVerification: () => void;
};

export const ReceiveAddressVerificationBottomSheet = ({
    ref,
    source,
    onVerifyAddress,
    onSkipVerification,
}: ReceiveAddressVerificationBottomSheetProps) => {
    const isSharedAddress = source === ReceiveAddressVerificationSource.Shared;
    const deviceName = useSelector(selectDeviceBrandName);
    const isTrezor = deviceName === 'Trezor';
    const sharedSubtitle = isTrezor
        ? 'moduleReceive.addressSharedBottomSheet.subtitle'
        : 'moduleReceive.addressSharedBottomSheet.deviceSubtitle';

    return (
        <BottomSheetModal ref={ref}>
            <VStack spacing="sp32">
                <VStack spacing={isSharedAddress ? 'sp12' : 0} alignItems="center">
                    <Text variant="headline-sm" textAlign="center">
                        <Translation
                            id={
                                isSharedAddress
                                    ? 'moduleReceive.addressSharedBottomSheet.title'
                                    : 'moduleReceive.addressCopiedBottomSheet.title'
                            }
                        />
                    </Text>
                    <Text variant={isSharedAddress ? 'body-md' : 'headline-sm'} textAlign="center">
                        <Translation
                            id={
                                isSharedAddress
                                    ? sharedSubtitle
                                    : 'moduleReceive.addressCopiedBottomSheet.subtitle'
                            }
                            values={{ deviceName }}
                        />
                    </Text>
                </VStack>
                {!isSharedAddress && (
                    <IconList textVariant="body-md">
                        <IconListTextItem icon={1}>
                            <Translation id="moduleReceive.addressCopiedBottomSheet.steps.pasteAddress" />
                        </IconListTextItem>
                        <IconListTextItem icon={2}>
                            <Translation
                                id={
                                    isTrezor
                                        ? 'moduleReceive.addressCopiedBottomSheet.steps.verifyAddress'
                                        : 'moduleReceive.addressCopiedBottomSheet.steps.verifyAddressOnDevice'
                                }
                                values={{ deviceName }}
                            />
                        </IconListTextItem>
                    </IconList>
                )}
                <VStack spacing="sp12">
                    <Button
                        testID={`@receive/address-verification/${source}/verify-button`}
                        onPress={onVerifyAddress}
                        isFullWidth
                    >
                        <Translation
                            id={
                                isTrezor
                                    ? 'moduleReceive.addressCopiedBottomSheet.buttons.verifyOnTrezor'
                                    : 'moduleReceive.addressCopiedBottomSheet.buttons.verifyOnDevice'
                            }
                            values={{ deviceName }}
                        />
                    </Button>
                    <Button
                        intent="neutral"
                        priority="secondary"
                        onPress={onSkipVerification}
                        isFullWidth
                    >
                        <Translation id="moduleReceive.addressCopiedBottomSheet.buttons.skipVerification" />
                    </Button>
                </VStack>
            </VStack>
        </BottomSheetModal>
    );
};
