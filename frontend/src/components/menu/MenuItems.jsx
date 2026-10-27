import { useContext, useEffect, useState } from 'react';
import { CartContext } from '../../context/CartContext';
import { useTranslation } from 'react-i18next';
import MenuItem from './MenuItem';
import './MenuItems.css';
import { AuthContext } from '../../context/AuthContext';

function MenuItems({ menu }) {
    const { t } = useTranslation();
    const { userId } = useContext(AuthContext);
    const { cart, showing, setShowing } = useContext(CartContext);
    const [showCheckout, setShowCheckout] = useState(false);

    useEffect(() => {
        if (cart.length > 0 && showing === false && userId) {
            setShowCheckout(true);
        } else {
            setShowCheckout(false);
        }
    }, [cart, showing, userId]);

    const handleClickCheckout = () => {
        setShowing(true);
    };

    return (
        <div className="menu-items-container">
            <h2 className="menu-title">{t('menu')}</h2>
            {menu.map((category) => (
                <div key={category.id} className="category-container">
                    <h3 className="category-title">{category.name}</h3>
                    <ul className="menu-item-list">
                        {category.items.map((menuItem) => (
                            <MenuItem key={menuItem.id} menuItem={menuItem} />
                        ))}
                    </ul>
                </div>
            ))}
            {showCheckout ? (
                <button
                    className="menu-checkout-button"
                    onClick={() => handleClickCheckout()}
                >
                    {t('viewOrder')} <span className="cart-count">{cart.length}</span>
                </button>
            ) : (
                <div className="menu-checkout-placeholder"></div>
            )}
        </div>
    );
}

export default MenuItems;