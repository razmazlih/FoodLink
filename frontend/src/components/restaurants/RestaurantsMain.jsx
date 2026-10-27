import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RestaurantSearch from './RestaurantSearch';
import RestaurantsTemplate from './RestaurantsTemplate';
import { getRestaurants } from '../../services/DishBoard/restaurants/api';
import './RestaurantsMain.css';

function RestaurantsMain() {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [restaurants, setRestaurants] = useState(
        JSON.parse(localStorage.getItem('restaurants')) || []
    );
    const [openStatus, setOpenStatus] = useState(JSON.parse(localStorage.getItem('openStatus')) || {});

    useEffect(() => {
        fetchRestaurants();
    }, []);

    const fetchRestaurants = async () => {
        try {
            const data = await getRestaurants();
            localStorage.setItem('restaurants', JSON.stringify(data));
            setRestaurants(data);
        } catch (error) {
            console.error('Error fetching restaurants:', error);
        }
    };

    const filteredRestaurants = restaurants.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const updateOpenStatuses = useCallback((updatedStatus, restaurantId) => {
        setOpenStatus((prev) => {
            const newStatus = { 
                ...prev, 
                [restaurantId]: updatedStatus
            };
            localStorage.setItem('openStatus', JSON.stringify(newStatus));
            return newStatus;
        });
    }, []);

    return (
        <div className="restaurants-main">
            <h2 className="restaurants-main-title">{t('restaurantsTitle')}</h2>
            <RestaurantSearch
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
            />
            <div className="restaurants-main-list">
                {filteredRestaurants.map((restaurant) => (
                    <RestaurantsTemplate
                        key={restaurant.id}
                        restaurant={restaurant}
                        openStatus={openStatus}
                        updateOpenStatuses={updateOpenStatuses}
                    />
                ))}
            </div>
        </div>
    );
}

export default RestaurantsMain;