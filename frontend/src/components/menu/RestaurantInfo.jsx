import { useTranslation } from 'react-i18next';
import './RestaurantInfo.css';

function RestaurantInfo({ restaurant }) {
    const { t } = useTranslation();
    return (
        <div className="restaurant-info">
            <h2>{restaurant.name}</h2>
            <h3>
                {restaurant.address}, {restaurant.city}
            </h3>
            {restaurant.source_url && (
                <p>
                    <a href={restaurant.source_url} target="_blank" rel="noopener noreferrer">{t('menuSource')}</a>
                    {restaurant.verified_on && <> · {t('menuVerifiedOn', { date: restaurant.verified_on })}</>}
                </p>
            )}
            {restaurant.price_context && <p>{restaurant.price_context}</p>}
            {restaurant.catalog_only && <p role="note">{t('catalogOnlyNotice')}</p>}
        </div>
    );
}

export default RestaurantInfo;