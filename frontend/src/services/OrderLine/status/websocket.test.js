import socket from './websocket';
import { getAccessToken } from '../../../firebase';

jest.mock('../../../firebase', () => ({ getAccessToken: jest.fn() }));

test('connects to the existing order route, delivers raw messages and disconnects', () => {
    const original = global.WebSocket;
    const connection = { close: jest.fn() };
    global.WebSocket = jest.fn(() => connection);
    try {
        const receive = jest.fn();
        socket.connect(12, receive);
        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/\/ws\/order-status\/12$/));
        connection.onmessage({ data: 'delivered' });
        expect(receive).toHaveBeenCalledWith('delivered');
        socket.disconnect();
        expect(connection.close).toHaveBeenCalledTimes(1);
    } finally {
        socket.disconnect();
        global.WebSocket = original;
    }
});


test('late close from the previous connection retains the new connection', () => {
    const original = global.WebSocket;
    const previous = { close: jest.fn() };
    const current = { close: jest.fn() };
    global.WebSocket = jest.fn().mockReturnValueOnce(previous).mockReturnValueOnce(current);
    try {
        socket.connect(12, jest.fn());
        socket.disconnect();
        socket.connect(13, jest.fn());
        previous.onclose();
        socket.disconnect();
        expect(current.close).toHaveBeenCalledTimes(1);
        expect(previous.close).toHaveBeenCalledTimes(1);
    } finally {
        socket.disconnect();
        global.WebSocket = original;
    }
});

describe('recovery after free-host sleep or restart', () => {
    let original;
    let connections;
    beforeEach(() => {
        jest.useFakeTimers();
        original = global.WebSocket;
        connections = [];
        global.WebSocket = jest.fn(() => {
            const connection = { close: jest.fn(), send: jest.fn() };
            connections.push(connection);
            return connection;
        });
        getAccessToken.mockReset();
        getAccessToken.mockResolvedValue('fresh-token');
    });
    afterEach(() => {
        socket.disconnect();
        global.WebSocket = original;
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('backs off failed connections and caps each delay at 30 seconds', () => {
        socket.connect(12, jest.fn());
        for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
            connections[connections.length - 1].onclose({ code: 1006 });
            const count = connections.length;
            jest.advanceTimersByTime(delay - 1);
            expect(connections).toHaveLength(count);
            jest.advanceTimersByTime(1);
            expect(connections).toHaveLength(count + 1);
        }
        expect(global.WebSocket).toHaveBeenLastCalledWith(expect.stringMatching(/\/ws\/order-status\/12$/));
    });

    test('reauthenticates, refreshes missed state and resumes live messages on reconnect', async () => {
        const receive = jest.fn();
        socket.connect(12, receive);
        await connections[0].onopen();
        connections[0].onclose({ code: 1006 });
        jest.advanceTimersByTime(1000);
        getAccessToken.mockResolvedValue('refreshed-token');
        await connections[1].onopen();
        expect(connections[1].send).toHaveBeenCalledWith(JSON.stringify({ type: 'auth', token: 'refreshed-token' }));
        expect(receive).toHaveBeenCalledTimes(1);
        connections[0].onmessage({ data: 'stale' });
        expect(receive).toHaveBeenCalledTimes(1);
        connections[1].onmessage({ data: 'delivered' });
        expect(receive).toHaveBeenLastCalledWith('delivered');
        connections[1].onclose({ code: 1006 });
        jest.advanceTimersByTime(1000);
        expect(connections).toHaveLength(3);
    });

    test('disconnect cancels pending retries and intentional closes do not reconnect', () => {
        socket.connect(12, jest.fn());
        connections[0].onclose({ code: 1006 });
        socket.disconnect();
        jest.advanceTimersByTime(60000);
        expect(connections).toHaveLength(1);
        socket.connect(13, jest.fn());
        socket.disconnect();
        connections[1].onclose({ code: 1000 });
        jest.advanceTimersByTime(60000);
        expect(connections).toHaveLength(2);
    });

    test.each([4401, 4403])('does not retry a server authorization rejection (%s)', (code) => {
        socket.connect(12, jest.fn());
        connections[0].onclose({ code });
        jest.advanceTimersByTime(60000);
        expect(connections).toHaveLength(1);
        socket.connect(13, jest.fn());
        expect(connections).toHaveLength(2);
    });

    test('an old token lookup cannot authenticate or close a newer connection', async () => {
        let rejectToken;
        getAccessToken.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectToken = reject; }));
        socket.connect(12, jest.fn());
        const pending = connections[0].onopen();
        socket.disconnect();
        socket.connect(13, jest.fn());
        rejectToken(new Error('old lookup failed'));
        await pending;
        expect(connections[1].close).not.toHaveBeenCalled();
        expect(connections[0].send).not.toHaveBeenCalled();
    });

    test('missing client authentication stops recovery instead of retrying', async () => {
        getAccessToken.mockResolvedValue(null);
        socket.connect(12, jest.fn());
        await connections[0].onopen();
        connections[0].onclose({ code: 1000 });
        jest.advanceTimersByTime(60000);
        expect(connections).toHaveLength(1);
        expect(connections[0].close).toHaveBeenCalledTimes(1);
    });
});
