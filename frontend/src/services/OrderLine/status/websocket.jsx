import { getAccessToken } from '../../../firebase';
import { WEBSOCLET_ORDERLINE_URL } from '../../../config';

const MAX_RECONNECT_DELAY = 30000;

class WebSocketService {
    constructor() {
        if (!WebSocketService.instance) {
            this.socket = null;
            this.subscription = null;
            this.reconnectTimer = null;
            WebSocketService.instance = this;
        }
        return WebSocketService.instance;
    }

    connect(orderId, onMessageCallback) {
        if (this.subscription) {
            console.warn(`WebSocket already connected for order ${orderId}`);
            return;
        }
        const subscription = { orderId, onMessageCallback, reconnectAttempts: 0 };
        this.subscription = subscription;
        this.open(subscription);
    }

    scheduleReconnect(subscription) {
        if (this.subscription !== subscription || this.reconnectTimer !== null) return;
        const delay = Math.min(1000 * (2 ** subscription.reconnectAttempts), MAX_RECONNECT_DELAY);
        subscription.reconnectAttempts = Math.min(subscription.reconnectAttempts + 1, 5);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.subscription === subscription) this.open(subscription, true);
        }, delay);
    }

    open(subscription, reconnecting = false) {
        let socket;
        try {
            socket = new WebSocket(`${WEBSOCLET_ORDERLINE_URL}/ws/order-status/${subscription.orderId}`);
        } catch (error) {
            this.scheduleReconnect(subscription);
            return;
        }
        this.socket = socket;

        socket.onopen = async () => {
            try {
                const token = await getAccessToken();
                if (this.socket !== socket || this.subscription !== subscription) return;
                if (!token) { this.disconnect(); return; }
                socket.send(JSON.stringify({ type: 'auth', token }));
                subscription.reconnectAttempts = 0;
                // Refresh authoritative state after a gap in live notifications.
                if (reconnecting && subscription.onMessageCallback) subscription.onMessageCallback();
            } catch (error) {
                if (this.socket !== socket || this.subscription !== subscription) return;
                console.error('Unable to authenticate order updates');
                this.disconnect();
            }
        };

        socket.onmessage = (event) => {
            if (this.socket === socket && this.subscription === subscription && subscription.onMessageCallback) {
                subscription.onMessageCallback(event.data);
            }
        };

        socket.onerror = (error) => {
            if (this.socket === socket) console.error('WebSocket Error:', error);
        };

        socket.onclose = (event) => {
            if (this.socket !== socket || this.subscription !== subscription) return;
            this.socket = null;
            if (event?.code === 4401 || event?.code === 4403) {
                this.subscription = null;
                return;
            }
            this.scheduleReconnect(subscription);
        };
    }

    disconnect() {
        this.subscription = null;
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        const socket = this.socket;
        this.socket = null;
        if (socket) socket.close();
    }
}

const websocketInstance = new WebSocketService();
export default websocketInstance;
