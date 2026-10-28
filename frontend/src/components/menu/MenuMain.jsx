import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRestaurantById } from '../../services/DishBoard/restaurants/api';
import { getRestaurantMenu } from '../../services/DishBoard/menu/api';
import RestaurantInfo from './RestaurantInfo';
import MenuItems from './MenuItems';
import './MenuMain.css';

function MenuMain() {
    const { t } = useTranslation();
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [restaurantInfo, setRestaurantInfo] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        const fetchData = async () => {
            setLoading(true);
            setError(false);
            try {
                const [restaurant, menu] = await Promise.all([
                    getRestaurantById(restaurantId),
                    getRestaurantMenu(restaurantId),
                ]);
                if (!active) return;
                if (!restaurant) throw new Error('Restaurant unavailable');
                setRestaurantInfo(restaurant);
                setMenuItems(menu);
            } catch (error) {
                console.error('Error fetching data:', error);
                if (active) setError(true);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchData();
        return () => { active = false; };
    }, [restaurantId, attempt]);

    return (
        <div className="menu-main">
            <button className="menu-back-link" onClick={() => navigate('/restaurants')}>{t('viewRestaurants')} <span aria-hidden="true">↗</span></button>
            {loading ? (
                <div className="loading-container" role="status">
                    <div className="spinner"></div>
                    <p className="loading-text">{t('loadingMenu')}</p>
                </div>
            ) : error ? (
                <div className="menu-error-state" role="alert"><span aria-hidden="true">↻</span><h2>{t('flowUnavailableTitle')}</h2><p>{t('flowUnavailableDescription')}</p><button onClick={() => setAttempt((value) => value + 1)}>{t('tryAgain')}</button></div>
            ) : (
                <>
                    <RestaurantInfo restaurant={restaurantInfo} />
                    <MenuItems menu={menuItems} />
                </>
            )}
        </div>
    );
}

export default MenuMain;