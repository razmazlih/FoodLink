import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './RestaurantSearch.css';

function RestaurantSearch({ searchTerm, setSearchTerm }) {
    const [tempSearchTerm, setTempSearchTerm] = useState(searchTerm);
    const { t } = useTranslation();

    const handleSearch = () => {
        if (tempSearchTerm.trim() === '') {
            return;
        }
        setSearchTerm(tempSearchTerm);
    };

    return (
        <div className="restaurant-search">
            <input
                type="text"
                placeholder={t('searchRestaurants')}
                value={tempSearchTerm}
                onChange={(e) => setTempSearchTerm(e.target.value)}
            />
            <div className="buttons">
                <button className="search" onClick={handleSearch}>
                    {t('search')}
                </button>
                <button className="clear" onClick={() => setSearchTerm('')}>
                    {t('reset')}
                </button>
            </div>
        </div>
    );
}

export default RestaurantSearch;