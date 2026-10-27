import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchOrder } from '../../services/OrderLine/order/api';
import { getMenuItemNameById } from '../../services/DishBoard/menu/api';
import { updateCartStatus } from '../../services/OrderLine/status/api';
import websocketInstance from '../../services/OrderLine/status/websocket';
import './OrderDetails.css';

function OrderDetailsMain() {
    const { t, i18n } = useTranslation();
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [orderDetails, setOrderDetails] = useState(null);
    const [itemNames, setItemNames] = useState({});
    const [latestStatus, setLatestStatus] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        const loadOrderDetails = async () => {
            try {
                const order = await fetchOrder(orderId);
                if (!order || !order.items) throw new Error("Invalid order data");

                setOrderDetails(order);
                if (order.status.length > 0) {
                    const lastStatus = order.status[order.status.length - 1];
                    setLatestStatus(lastStatus.status);
                    setLastUpdated(new Date(lastStatus.updated_at));
                }

                // טעינת שמות הפריטים לפי menu_item_id
                const fetchedNames = {};
                for (const item of order.items) {
                    if (!item.name) {
                        fetchedNames[item.menu_item_id] = await getMenuItemNameById(item.menu_item_id);
                    }
                }

                setItemNames((prev) => ({ ...prev, ...fetchedNames }));
            } catch (error) {
                console.error("Error fetching order details:", error);
            }
        };

        loadOrderDetails();

        // התחברות ל-WebSocket להאזנה לשינויים בסטטוס
        websocketInstance.connect(orderId, (newStatus, updatedAt) => {
            console.log("📡 עדכון סטטוס:", newStatus, "🕒", updatedAt);
            setLatestStatus(newStatus);
            setLastUpdated(new Date(updatedAt));
        });

        return () => {
            websocketInstance.disconnect();
        };
    }, [orderId]);

    const formatDate = (date) => {
        if (!date) return t('loading');
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
        return new Date(date).toLocaleString(locale, options);
    };

    const shortenDate = (date) => {
        if (!date) return t('loading');
        const options = { hour: '2-digit', minute: '2-digit' };
        const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
        return new Date(date).toLocaleString(locale, options);
    };

    const handleCancelOrder = async () => {
        if (!orderDetails) return;
        await updateCartStatus(orderId, 'cancelled');
        setLatestStatus('cancelled');
        setLastUpdated(new Date());
    };

    if (!orderDetails) return <p className="order-details-loading">{t('loading')}</p>;

    return (
        <div className="order-details-page">
            <h1 className="order-details-page-title">{t('orderDetailsTitle')}</h1>
            <p className="order-details-page-date">{formatDate(orderDetails.ordered_at)}</p>
            
            <div className="order-details-status-container">
                <p className="order-details-status">
                    <strong>{t('orderStatus')}:</strong> 
                    <span className={`order-status-${latestStatus}`}>
                        {t(latestStatus)}
                    </span>
                </p>
                {lastUpdated && (
                    <p className="order-details-last-updated">
                        ⏱ {shortenDate(lastUpdated)}
                    </p>
                )}
            </div>

            <div className="order-details-page-items">
                {orderDetails.items.length > 0 ? (
                    orderDetails.items.map((item) => (
                        <div className="order-details-page-item" key={item.id}>
                            <p className="order-details-page-item-name">
                                {item.name || itemNames[item.menu_item_id] || t('loading')} - {Number(item.price)}₪ 
                                {item.quantity > 1 && ` x ${item.quantity}`}
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="order-details-page-no-items">{t('noItems')}</p>
                )}
            </div>

            <h3 className="order-details-page-total">{t('total')}: {orderDetails.total_price}₪</h3>

            {latestStatus === 'active' && (
                <button className="order-details-page-cancel-button" onClick={handleCancelOrder}>
                    {t('cancelOrder')}
                </button>
            )}

            <button className="order-details-page-button" onClick={() => navigate('/my-orders')}>
                {t('backToOrders')}
            </button>
        </div>
    );
}

export default OrderDetailsMain;