import { useContext, useEffect, useState } from 'react';
import { fetchAllOrders } from '../../services/OrderLine/order/api';
import { AuthContext } from '../../context/AuthContext';
import { getRestaurantsNamesAndIds } from '../../services/DishBoard/restaurants/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Orders.css';
import { CartContext } from '../../context/CartContext';
import SingleOrder from './SingleOrder';

function Orders() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { userId } = useContext(AuthContext);
    const { cart } = useContext(CartContext);
    const [myOrders, setMyOrders] = useState(
        JSON.parse(localStorage.getItem('myOrders')) || []
    );
    const [restaurantMap, setRestaurantMap] = useState(
        JSON.parse(localStorage.getItem('restaurantMap')) || {}
    );
    const [myReservations, setMyReservations] = useState(
        JSON.parse(localStorage.getItem('myReservations')) || []
    );

    useEffect(() => {
        fetchAllOrders(userId).then((orders) => {
            const sortedOrders = orders.sort((a, b) => {
                const statusA = a.status?.[a.status.length - 1]?.updated_at;
                const statusB = b.status?.[b.status.length - 1]?.updated_at;

                if (!statusA && statusB) return -1;
                if (statusA && !statusB) return 1;

                if (statusA && statusB) {
                    const dateA = new Date(statusA);
                    const dateB = new Date(statusB);
                    return dateB - dateA;
                }

                return a.id - b.id;
            });
            localStorage.setItem('myOrders', JSON.stringify(sortedOrders));
            return setMyOrders(sortedOrders);
        });
        getRestaurantsNamesAndIds().then((response) => {
            const map = {};
            response.forEach((restaurant) => {
                map[restaurant.id] = restaurant.name;
            });
            setRestaurantMap(map);
            localStorage.setItem('restaurantMap', JSON.stringify(map));
        });

        if (userId) {
            fetchAllOrders(userId).then((response) => {
                setMyReservations(response);
                localStorage.setItem(
                    'myReservations',
                    JSON.stringify(response)
                );
            });
        }
    }, [userId, cart]);

    const showingOrders = myOrders.map((order) => (
        <SingleOrder
            key={order.id}
            order={order}
            myOrders={myOrders}
            setMyOrders={setMyOrders}
            restaurantMap={restaurantMap}
            myReservations={myReservations}
        />
    ));

    return (
        <div className="orders-container">
            <h2 className="orders-title">{t('myOrders')}</h2>
            <button
                className="btn-start-new-order"
                onClick={() => navigate('/restaurants')}
            >
                {t('viewRestaurants')}
            </button>
            {showingOrders}
        </div>
    );
}

export default Orders;