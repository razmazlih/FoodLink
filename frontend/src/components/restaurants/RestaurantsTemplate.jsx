import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isRestaurantOpen } from '../../services/DishBoard/restaurants/api';
import { useNavigate } from 'react-router-dom';
import { fetchAllOrders, fetchOrder } from '../../services/OrderLine/order/api';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import './RestaurantsTemplate.css';

function RestaurantsTemplate({ restaurant, openStatus, updateOpenStatuses }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isOpenNow = openStatus[restaurant.id] || { status: 'close' };
    const [hasActiveReservation, setHasActiveReservation] = useState(false);
    const { userId } = useContext(AuthContext);
    const { updateCart, createNewCart } = useContext(CartContext);
    const [myReservations, setMyReservations] = useState(
        JSON.parse(localStorage.getItem('myReservations')) || []
    );
    const { i18n } = useTranslation();

    useEffect(() => {
        isRestaurantOpen(restaurant.id)
            .then((data) => {
                updateOpenStatuses(data, restaurant.id);
            })
            .catch((error) => {
                console.error('Error fetching opening hours:', error);
            });
    }, [restaurant.id, updateOpenStatuses]);


    useEffect(() => {
        document.documentElement.lang = i18n.language;
        document.documentElement.dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    }, [i18n.language]);

    useEffect(() => {
        const checkReservation = async (restaurantId, userId) => {
            try {
                const isReservationFound = myReservations.some((order) => {
                    return (
                        order.restaurant_id === restaurantId &&
                        order.user_id === Number(userId) &&
                        order.status.length === 0
                    );
                });
                setHasActiveReservation(isReservationFound);
            } catch (error) {
                console.error('Error checking reservation:', error);
            }
        };

        if (userId) {
            checkReservation(restaurant.id, userId);
        }
    }, [restaurant.id, userId, myReservations]);

    useEffect(() => {
        if (userId) {
            fetchAllOrders(userId).then((response) => {
                setMyReservations(response);
                localStorage.setItem(
                    'myReservations',
                    JSON.stringify(response)
                );
            });
        }
    }, [userId]);

    async function handleContainerClick() {
        if (userId) {
            if (hasActiveReservation) {
                const reservation = myReservations.find((order) => {
                    return (
                        order.restaurant_id === restaurant.id &&
                        order.status.length === 0
                    );
                });

                if (reservation) {
                    const order = await fetchOrder(reservation.id);
                    updateCart(order.items, order.id);
                }
            } else {
                createNewCart(userId, restaurant.id);
            }
        }
        navigate(`/restaurants/${restaurant.id}`);
    }

    return (
        <div
            className="restaurant-card"
            onClick={handleContainerClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleContainerClick()}
        >
            <img
                className="restaurant-photo"
                src={restaurant.photo_url}
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
                        {isOpenNow.is_open
                            ? `${t('closesAt')} ${isOpenNow.closes_at.slice(0, 5)}`
                            : isOpenNow.next_day
                            ? `${t('opensAt')} ${t(isOpenNow.next_day)}, ${isOpenNow.opens_at.slice(0, 5)}`
                            : t('restaurantNotUpdated')}
                    </span>
                </p>
            </div>
            <p>
                {restaurant.address}, {restaurant.city}
            </p>
        </div>
    );
}

export default RestaurantsTemplate;