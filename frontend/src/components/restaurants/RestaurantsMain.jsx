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

    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const fetchRestaurants = useCallback(async () => {
        setIsLoading(true);
        setLoadError(false);
        try {
            const data = await getRestaurants();
            localStorage.setItem('restaurants', JSON.stringify(data));
            setRestaurants(data);
        } catch (error) {
            setLoadError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRestaurants();
    }, [fetchRestaurants]);

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
            {loadError && (
                <div className="restaurant-load-notice" role="alert">
                    <div><strong>{t('restaurantsUnavailable')}</strong><p>{t(restaurants.length ? 'restaurantsCachedNotice' : 'restaurantsRetryNotice')}</p></div>
                    <button onClick={fetchRestaurants}>{t('tryAgain')}</button>
                </div>
            )}
            {isLoading && <div className="restaurant-empty-state" role="status"><span className="state-symbol" aria-hidden="true">◷</span><h3>{t('restaurantsLoading')}</h3><p>{t('restaurantsLoadingNote')}</p></div>}
            {!isLoading && !loadError && restaurants.length === 0 && <div className="restaurant-empty-state" role="status"><span className="state-symbol" aria-hidden="true">✳</span><h3>{t('restaurantsEmpty')}</h3><p>{t('restaurantsEmptyNote')}</p></div>}
            {!isLoading && restaurants.length > 0 && filteredRestaurants.length === 0 && <div className="restaurant-empty-state" role="status"><span className="state-symbol" aria-hidden="true">⌕</span><h3>{t('restaurantsNoMatches')}</h3><p>{t('restaurantsNoMatchesNote')}</p></div>}
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