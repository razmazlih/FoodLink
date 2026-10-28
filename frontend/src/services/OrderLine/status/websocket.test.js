import socket from './websocket';

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
