import { useContext } from 'react';
import { deleteOrder, fetchOrder } from '../../services/OrderLine/order/api';
import { CartContext } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function SingleOrder({
    order,
    restaurantMap,
    myReservations,
    myOrders,
    setMyOrders,
}) {
    const { updateCart } = useContext(CartContext);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const hundleViewOrderDetails = (orderId) => {
        navigate(`/order-details/${orderId}`);
    };

    const hundleDeleteOrder = (orderId) => {
        deleteOrder(orderId);
        const filteredOrders = myOrders.filter((order) => order.id !== orderId);
        setMyOrders(filteredOrders);
        localStorage.setItem('myOrders', JSON.stringify(filteredOrders));
        localStorage.removeItem('orderId');
        localStorage.removeItem('cartItems');
    };

    const hundleContinueCart = (restaurantId, inNavigate) => {
        const reservation = myReservations.find((order) => {
            return (
                order.restaurant_id === restaurantId &&
                order.status.length === 0
            );
        });

        if (reservation) {
            fetchOrder(reservation.id).then((order) => {
                updateCart(order.items, order.id);
                navigate(inNavigate);
            });
        } else {
            console.warn('No reservation found for this restaurant.');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        date.setHours(date.getHours() + 2);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    };

    const ShowOrder = order.total_price > 0 && (
        <div key={order.id} className="order-item">
            <h2 className="order-title">
                {restaurantMap[order.restaurant_id]} - {order.total_price}₪
            </h2>
            {order.status.length === 0 ? (
                <>
                    <button
                        className="btn-continue-ordering button-spaced"
                        onClick={() =>
                            hundleContinueCart(
                                order.restaurant_id,
                                `/restaurants/${order.restaurant_id}/`
                            )
                        }
                    >
                        {t('continueOrdering')}
                    </button>
                    <button
                        className="btn-checkout-order button-spaced"
                        onClick={() =>
                            hundleContinueCart(
                                order.restaurant_id,
                                `/my-orders/checkout/${order.id}`
                            )
                        }
                    >
                        {t('checkout')}
                    </button>
                    <button
                        className="btn-delete-order button-spaced"
                        onClick={() => hundleDeleteOrder(order.id)}
                    >
                        {t('deleteOrder')}
                    </button>
                </>
            ) : (
                <>
                    <p>
                        <span className="updated-time">
                            {t('updatedTime')}: {formatDate(order.status[order.status.length - 1].updated_at)}
                        </span>
                    </p>
                    <div className="order-status">
                        <span
                            className={
                                order.status[order.status.length - 1].status ===
                                'active'
                                    ? 'order-status-active'
                                    : 'order-status-delivered'
                            }
                        >
                            {t('orderStatus')} {t(order.status[order.status.length - 1].status)}
                        </span>
                        <button
                            className="btn-view-order-details button-spaced"
                            onClick={() => hundleViewOrderDetails(order.id)}
                        >
                            {t('viewOrderDetails')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
    return ShowOrder;
}

export default SingleOrder;