import { getAccessToken } from '../../../firebase';
import { WEBSOCLET_ORDERLINE_URL } from '../../../config';

class WebSocketService {
    constructor() {
        if (!WebSocketService.instance) {
            this.socket = null;
            WebSocketService.instance = this;
        }
        return WebSocketService.instance;
    }

    connect(orderId, onMessageCallback) {
        if (this.socket) {
            console.warn(`WebSocket already connected for order ${orderId}`);
            return;
        }

        const socket = new WebSocket(
            `${WEBSOCLET_ORDERLINE_URL}/ws/order-status/${orderId}`
        );

        this.socket = socket;

        socket.onopen = async () => {
            try {
                const token = await getAccessToken();
                if (this.socket !== socket) return;
                if (!token) { socket.close(); return; }
                socket.send(JSON.stringify({ type: 'auth', token }));
            } catch (error) {
                console.error('Unable to authenticate order updates');
                socket.close();
            }
        };

        socket.onmessage = (event) => {
            if (onMessageCallback) {
                onMessageCallback(event.data);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        socket.onclose = () => {
            if (this.socket === socket) this.socket = null;
        };
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

const websocketInstance = new WebSocketService();
export default websocketInstance;
