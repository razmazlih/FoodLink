import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRestaurantById } from '../../services/DishBoard/restaurants/api';
import { getRestaurantMenu } from '../../services/DishBoard/menu/api';
import RestaurantInfo from './RestaurantInfo';
import MenuItems from './MenuItems';
import './MenuMain.css';

function MenuMain() {
    const { t } = useTranslation();
    const { restaurantId } = useParams();
    const [restaurantInfo, setRestaurantInfo] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [restaurant, menu] = await Promise.all([
                    getRestaurantById(restaurantId),
                    getRestaurantMenu(restaurantId),
                ]);
                setRestaurantInfo(restaurant);
                setMenuItems(menu);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [restaurantId]);

    return (
        <div className="menu-main">
            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p className="loading-text">{t('loadingMenu')}</p>
                </div>
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