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

        this.socket = new WebSocket(
            `${WEBSOCLET_ORDERLINE_URL}/ws/order-status/${orderId}`
        );

        this.socket.onmessage = (event) => {
            if (onMessageCallback) {
                onMessageCallback(event.data);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        this.socket.onclose = () => {
            this.socket = null;
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
