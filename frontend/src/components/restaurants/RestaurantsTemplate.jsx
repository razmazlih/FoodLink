
import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { isRestaurantOpen } from '../../services/DishBoard/restaurants/api';
import { fetchAllOrders, fetchOrder } from '../../services/OrderLine/order/api';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';

import './RestaurantsTemplate.css';

function RestaurantsTemplate({
    restaurant,
    openStatus,
    updateOpenStatuses,
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { userId } = useContext(AuthContext);
    const { orderId, updateCart, createNewCart } = useContext(CartContext);

    const [photoFailed, setPhotoFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);

    const requestInFlight = useRef(false);

    const isOpenNow = openStatus[restaurant.id] || {
        is_open: false,
    };

    useEffect(() => {
        let active = true;

        isRestaurantOpen(restaurant.id)
            .then((status) => {
                if (active) {
                    updateOpenStatuses(status, restaurant.id);
                }
            })
            .catch((err) => {
                console.error('Failed to load opening hours:', err);
            });

        return () => {
            active = false;
        };
    }, [restaurant.id, updateOpenStatuses]);

    const handleContainerClick = async () => {
        // Prevent repeated clicks from starting duplicate requests.
        if (requestInFlight.current) return;

        requestInFlight.current = true;
        setBusy(true);
        setError(false);

        try {
            if (userId) {
                // Always read current orders from the server.
                const orders = await fetchAllOrders(userId);

                const drafts = orders.filter((order) => {
                    return (
                        order.user_id === userId &&
                        String(order.restaurant_id) ===
                            String(restaurant.id) &&
                        Array.isArray(order.status) &&
                        order.status.length === 0
                    );
                });

                // Prefer the currently selected draft.
                let draft = drafts.find(
                    (order) => String(order.id) === String(orderId)
                );

                // Otherwise, reuse the newest existing draft.
                if (!draft && drafts.length > 0) {
                    draft = drafts.reduce((latest, current) => {
                        if (!latest) return current;

                        return Number(current.id) > Number(latest.id)
                            ? current
                            : latest;
                    }, null);
                }

                if (draft) {
                    const existingOrder = await fetchOrder(draft.id);

                    updateCart(
                        existingOrder.items || [],
                        existingOrder.id
                    );
                } else {
                    // Wait for creation before opening the menu.
                    await createNewCart(userId, restaurant.id);
                }
            }

            navigate(`/restaurants/${restaurant.id}`);
        } catch (err) {
            console.error('Failed to prepare restaurant cart:', err);
            setError(true);
        } finally {
            requestInFlight.current = false;
            setBusy(false);
        }
    };

    const getOpeningMessage = () => {
        if (isOpenNow.is_open && isOpenNow.closes_at) {
            return `${t('closesAt')} ${isOpenNow.closes_at.slice(0, 5)}`;
        }

        if (isOpenNow.next_day && isOpenNow.opens_at) {
            return `${t('opensAt')} ${t(isOpenNow.next_day)}, ${isOpenNow.opens_at.slice(0, 5)}`;
        }

        return t('restaurantNotUpdated');
    };

    return (
        <div
            className="restaurant-card"
            onClick={handleContainerClick}
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-busy={busy}
            aria-disabled={busy}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleContainerClick();
                }
            }}
        >
            <img
                className="restaurant-photo"
                src={
                    !photoFailed && restaurant.photo_url
                        ? restaurant.photo_url
                        : `${process.env.PUBLIC_URL}/meal-illustration.svg`
                }
                onError={() => setPhotoFailed(true)}
                loading="lazy"
                decoding="async"
                alt={restaurant.name}
            />

            <div className="restaurants-info">
                <h3>{restaurant.name}</h3>

                <p className="tooltip-status">
                    <span
                        className={`restaurant-status ${
                            isOpenNow.is_open ? 'open' : 'close'
                        }`}
                    >
                        {isOpenNow.is_open ? t('open') : t('closed')}
                    </span>

                    <span className="tooltip-text">
                        {getOpeningMessage()}
                    </span>
                </p>
            </div>

            <p>
                {restaurant.address}, {restaurant.city}
            </p>

            {busy && (
                <p role="status">{t('loading')}</p>
            )}

            {error && (
                <p role="alert">{t('orderActionFailed')}</p>
            )}
        </div>
    );
}

export default RestaurantsTemplate;
