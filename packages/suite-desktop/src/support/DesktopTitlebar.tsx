import React, { MouseEvent, useEffect, useState } from 'react';
import styled from 'styled-components';
import { DESKTOP_TITLEBAR_HEIGHT, DESKTOP_WRAPPER_BORDER_WIDTH } from '@suite-constants/layout';
import { colors, TrezorLogo } from '@trezor/components';
import { isMacOs } from '@suite-utils/env';

const WRAPPER_BORDER_WIDTH = isMacOs() ? '0px' : DESKTOP_WRAPPER_BORDER_WIDTH;

const ContentWrapper = styled.div<{ maximized: boolean }>`
    height: ${props => (props.maximized ? '100%' : `calc(100% - ${DESKTOP_TITLEBAR_HEIGHT})`)};
    border-top: 0;
    border-right: ${WRAPPER_BORDER_WIDTH} solid ${colors.TYPE_DARK_GREY};
    border-bottom: ${WRAPPER_BORDER_WIDTH} solid ${colors.TYPE_DARK_GREY};
    border-left: ${WRAPPER_BORDER_WIDTH} solid ${colors.TYPE_DARK_GREY};
    overflow: hidden;
`;

const Titlebar = styled.div`
    display: block;
    height: ${DESKTOP_TITLEBAR_HEIGHT};
    width: 100%;
    position: fixed;
    z-index: 1000000;
    position: relative;
    background: ${colors.TYPE_DARK_GREY}; // not using theme on purpose
`;

const Drag = styled.div`
    -webkit-user-select: none;
    -webkit-app-region: drag;
    height: ${DESKTOP_TITLEBAR_HEIGHT};
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
`;

const LogoWrapper = styled.div`
    display: flex;
    width: 100%;
    height: 100%;
    align-content: center;
    align-items: center;
    justify-content: center;
`;

const DesktopTitlebar: React.FC = ({ children }) => {
    const [maximized, setMaximized] = useState(false);

    useEffect(() => {
        window.desktopApi!.on('window/is-maximized', (payload: boolean) => {
            setMaximized(payload);
        });
    }, []);

    const onClickTitlebar = (e: MouseEvent) => {
        // handle doubleclick and only on Mac (other platforms works out of the box)
        if (isMacOs() && e.detail === 2) {
            window.desktopApi!.windowExpand();
        }
    };

    return (
        <>
            {!maximized && (
                <Titlebar onClick={onClickTitlebar}>
                    <Drag />
                    <LogoWrapper>
                        <TrezorLogo
                            type="suite_compact"
                            fillColor="#FFFFFFB0"
                            width="48px"
                            data-test="trezor-suite-compact-logo-black"
                        />
                    </LogoWrapper>
                </Titlebar>
            )}
            <ContentWrapper maximized>{children}</ContentWrapper>
        </>
    );
};

export default DesktopTitlebar;
