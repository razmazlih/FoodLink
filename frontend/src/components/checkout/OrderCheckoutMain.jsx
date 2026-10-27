import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext';
import { useParams } from 'react-router-dom';
import { fetchOrder } from '../../services/OrderLine/order/api';
import OrderCheckoutItem from './OrderCheckoutItem';
import OrderSummary from './OrderSummary';
import './OrderCheckout.css';

function OrderCheckoutMain() {
    const { t, i18n } = useTranslation();
    const { orderId } = useParams();
    const { cart } = useContext(CartContext);
    const [myOrder, setMyOrder] = useState({ items: [], totalPrice: 0 });

    useEffect(() => {
        const mapItemName = JSON.parse(localStorage.getItem('cartNames')) || [];

        fetchOrder(orderId).then((order) => {
            const showOrder = {
                id: order.id,
                items: order.items.map((item) => ({
                    ...item,
                    name: mapItemName[item.id] || t('loading'),
                })),
                orderedAt: order.ordered_at,
                totalPrice: order.total_price,
                restaurantId: order.restaurant_id,
            };
            setMyOrder(showOrder);
        });
    }, [orderId, cart, t]);

    const formatDate = (date) => {
        if (!date) return t('loading');

        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        };

        const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
        return new Date(date).toLocaleString(locale, options);
    };

    return (
        <div className="order-checkout-main-container">
            <h1 className="order-checkout-main-title">{t('orderCheckoutTitle')}</h1>
            <p className="order-checkout-main-date">
                {formatDate(myOrder.orderedAt)}
            </p>
            <OrderCheckoutItem items={cart} />
            <OrderSummary totalPrice={myOrder.totalPrice} myOrder={myOrder} />
        </div>
    );
}

export default OrderCheckoutMain;