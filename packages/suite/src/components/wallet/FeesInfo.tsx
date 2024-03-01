import { ReactNode } from 'react';
import styled from 'styled-components';
import { H3, Icon, Paragraph, Tooltip, variables } from '@trezor/components';
import { spacingsPx } from '@trezor/theme';
import { formatNetworkAmount } from '@suite-common/wallet-utils';
import { FormattedCryptoAmount, FiatValue, Translation } from 'src/components/suite';
import { mapTestnetSymbol } from 'src/utils/wallet/coinmarket/coinmarketUtils';
import { NetworkSymbol } from '@suite-common/wallet-config';
import { PrecomposedTransaction, PrecomposedTransactionCardano } from '@suite-common/wallet-types';

const Flex = styled.div`
    display: flex;
    justify-content: space-between;
    min-height: 44px;
`;

const StyledH3 = styled(H3)`
    font-size: ${variables.FONT_SIZE.NORMAL};
    font-weight: ${variables.FONT_WEIGHT.DEMI_BOLD};
    line-height: normal;
`;

const StyledH3Wrapper = styled.div`
    display: flex;
    align-items: center;
    gap: ${spacingsPx.xxs};
`;

const Right = styled.div`
    text-align: right;
`;

const GreyP = styled(Paragraph)`
    margin-top: ${spacingsPx.xxs};
    color: ${({ theme }) => theme.textSubdued};
`;

const HelperTextWrapper = styled(GreyP)`
    font-size: ${variables.FONT_SIZE.SMALL};
`;

interface FeesInfoProps {
    symbol: NetworkSymbol;
    transactionInfo: PrecomposedTransaction | PrecomposedTransactionCardano | undefined;
    helperText?: ReactNode;
}

export const FeesInfo = ({ symbol, transactionInfo, helperText }: FeesInfoProps) => {
    const isFeeShown = transactionInfo !== undefined && transactionInfo.type !== 'error';
    const symbolForFiat = mapTestnetSymbol(symbol);

    return (
        <Flex>
            <div>
                <StyledH3Wrapper>
                    <StyledH3>
                        <Translation id="MAX_FEE" />
                    </StyledH3>

                    <Tooltip maxWidth={328} content={<Translation id="TR_STAKE_MAX_FEE_DESC" />}>
                        {/* TODO: Add new info icon. Export from Figma isn't handled as is it should by the strokes to fills online converter */}
                        <Icon icon="INFO" size={14} />
                    </Tooltip>
                </StyledH3Wrapper>

                {helperText && <HelperTextWrapper>{helperText}</HelperTextWrapper>}
            </div>

            <Right>
                {isFeeShown && (
                    <>
                        <Paragraph>
                            <FormattedCryptoAmount
                                disableHiddenPlaceholder
                                value={formatNetworkAmount(transactionInfo.fee, symbol)}
                                symbol={symbol}
                            />
                        </Paragraph>
                        <GreyP>
                            <FiatValue
                                disableHiddenPlaceholder
                                amount={formatNetworkAmount(transactionInfo.fee, symbolForFiat)}
                                symbol={symbolForFiat}
                            />
                        </GreyP>
                    </>
                )}
            </Right>
        </Flex>
    );
};
