import { type DeviceRootState, deviceReducerInitialState } from '@suite-common/device';
import { QueryClient, useQuery } from '@suite-common/react-query';
import { mockSuiteDevice } from '@suite-common/suite-types/mocks';
import TrezorConnect, { type DeviceUniquePath, type PROTO } from '@trezor/connect';

import { useCommonApplicationLogs } from './useCommonApplicationLogs';
import { REDACTED_REPLACEMENT } from '../utils';

const baseDevice = mockSuiteDevice();
if (baseDevice.type !== 'acquired') throw new Error('Expected acquired fixture');

const privatePath = 'private-trezor-path' as DeviceUniquePath;
const ledgerPath = 'ledger:private-id' as DeviceUniquePath;
const mockState: DeviceRootState = {
    device: {
        ...deviceReducerInitialState,
        devices: [
            { ...baseDevice, id: 'trezor-id', path: privatePath },
            {
                ...baseDevice,
                id: 'ledger-id',
                path: ledgerPath,
                unavailableCapabilities: { telemetry: 'no-support' },
            },
        ],
    },
};

jest.mock('react', () => ({
    ...jest.requireActual('react'),
    useState: () => [{}],
    useEffect: jest.fn(),
}));
jest.mock('react-redux', () => ({
    useSelector: (selector: (state: DeviceRootState) => unknown) => selector(mockState),
}));
jest.mock('@suite-common/react-query', () => ({
    ...jest.requireActual('@suite-common/react-query'),
    useQuery: jest.fn(),
}));
jest.mock('../logsSelectors', () => {
    const actual = jest.requireActual('../logsSelectors');

    return {
        ...actual,
        selectRedactedActionsLog: () => [],
        selectRedactedApplicationInfo: (state: DeviceRootState, hidden: boolean) => ({
            devices: actual.selectApplicationLogDevices(state).map((device: { path: string }) => ({
                path: hidden ? '[redacted]' : device.path,
            })),
        }),
    };
});

describe('application log telemetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(useQuery).mockReturnValue({
            data: undefined,
            isLoading: false,
        } as ReturnType<typeof useQuery>);
    });

    it('queries the real device path privately and skips unsupported Ledger telemetry', async () => {
        const telemetryGet = jest.spyOn(TrezorConnect, 'telemetryGet').mockResolvedValue({
            success: true,
            payload: { max_temp_c: 30 },
        });
        const logs = useCommonApplicationLogs(true);
        const query = jest.mocked(useQuery).mock.calls[0]?.[0];
        if (!query || typeof query.queryFn !== 'function') throw new Error('Expected query');

        const telemetry = await query.queryFn({
            signal: new AbortController().signal,
            queryKey: query.queryKey,
            client: new QueryClient(),
            meta: undefined,
        });

        expect(telemetryGet).toHaveBeenCalledTimes(1);
        expect(telemetryGet).toHaveBeenCalledWith({ device: { path: privatePath } });
        expect(telemetry).toEqual(new Map([[privatePath, { max_temp_c: 30 }]]));
        expect(JSON.stringify(logs)).not.toContain(privatePath);
        expect(JSON.stringify(logs)).not.toContain(ledgerPath);
        telemetryGet.mockRestore();
    });

    it('redacts the current output even when cached telemetry is reused', () => {
        const telemetry = new Map<DeviceUniquePath, PROTO.Telemetry>([
            [privatePath, { max_temp_c: 30 }],
        ]);
        jest.mocked(useQuery).mockReturnValue({
            data: telemetry,
            isLoading: false,
        } as ReturnType<typeof useQuery>);

        expect(JSON.stringify(useCommonApplicationLogs(false))).toContain(privatePath);
        const hidden = JSON.stringify(useCommonApplicationLogs(true));

        expect(hidden).not.toContain(privatePath);
        expect(hidden).not.toContain(ledgerPath);
        expect(hidden).toContain(REDACTED_REPLACEMENT);
        expect(hidden).toContain('"max_temp_c":30');
    });
});
