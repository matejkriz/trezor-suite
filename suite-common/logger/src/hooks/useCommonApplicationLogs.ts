import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { useQuery } from '@suite-common/react-query';
import TrezorConnect, { type DeviceUniquePath, type PROTO } from '@trezor/connect';

import {
    type LogsApplicationInfoRootState,
    selectApplicationLogDevices,
    selectRedactedActionsLog,
    selectRedactedApplicationInfo,
} from '../logsSelectors';
import { type LogsSliceRootState } from '../logsSlice';
import { type LogsEnvironmentInfo, getEnvironmentInfo, startTime } from '../utils';

export const useCommonApplicationLogs = (hideSensitiveInfo: boolean) => {
    const redactedActionsLog = useSelector((state: LogsSliceRootState) =>
        selectRedactedActionsLog(state, hideSensitiveInfo),
    );
    const redactedApplicationInfo = useSelector((state: LogsApplicationInfoRootState) =>
        selectRedactedApplicationInfo(state, hideSensitiveInfo),
    );
    const rawDevices = useSelector(selectApplicationLogDevices);

    const [envInfo, setEnvInfo] = useState<LogsEnvironmentInfo | null>(null);
    useEffect(() => {
        (async () => setEnvInfo(await getEnvironmentInfo()))();
    }, []);

    // Enhance devices info with telemetry data (battery temp, etc.)
    const devicePaths = new Set(
        rawDevices.filter(device => !device.unavailableCapabilities?.telemetry).map(d => d.path),
    );

    const { data: telemetryByPath, isLoading } = useQuery({
        queryKey: ['device-telemetry', ...devicePaths],
        queryFn: async ({ signal }) => {
            const telemetryByDevicePath = new Map<DeviceUniquePath, PROTO.Telemetry>();
            for (const path of devicePaths) {
                if (signal.aborted) break;
                const telemetry = await TrezorConnect.telemetryGet({
                    device: { path },
                });
                if (!telemetry.success) continue;
                telemetryByDevicePath.set(path, telemetry.payload);
            }

            return telemetryByDevicePath;
        },
        staleTime: 60 * 1000,
    });
    if (envInfo === null || isLoading) return null;

    const devicesWithTelemetry = redactedApplicationInfo.devices.map((device, index) => {
        const rawDevice = rawDevices[index];
        const telemetry = rawDevice ? telemetryByPath?.get(rawDevice.path) : undefined;

        return telemetry ? { ...device, telemetry } : device;
    });

    return [
        {
            ...envInfo,
            startTime,
            ...redactedApplicationInfo,
            devices: devicesWithTelemetry,
        },
        redactedActionsLog,
    ];
};
