import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function MenuItem({ menuItem }) {
    const { t } = useTranslation();
    const { userId } = useContext(AuthContext);
    const { addToCart, setShowing, checkInCart, cart } =
        useContext(CartContext);
    const [isInCart, setIsInCart] = useState(checkInCart(menuItem.id));
    const navigate = useNavigate();

    useEffect(() => {
        setIsInCart(checkInCart(menuItem.id));
    }, [cart, checkInCart, menuItem.id]);

    const handleAddToCart = () => {
        if (menuItem.is_available !== false) addToCart(menuItem);
    };

    const userLogin = (
        <button onClick={() => handleAddToCart()} className="add-to-cart-btn">
            {t('addToCart')}
        </button>
    );

    const inCart = (
        <button type="button" className="added-to-cart" onClick={() => setShowing(true)}>
            <span aria-hidden="true">✓ </span>{t('added')}
        </button>
    );

    const handleIsLoginIsInCart = userId ? (
        isInCart ? (
            inCart
        ) : (
            userLogin
        )
    ) : (
        <button type="button" className="login-prompt-menu" onClick={() => navigate('/login')}>
            {t('pleaseLogin')}
        </button>
    );

    return (
        <li className="menu-item" key={menuItem.id}>
            <div className="menu-item-header">
                <strong className="menu-item-name">{menuItem.name}</strong>
                <span className="price">{menuItem.price}₪</span>
            </div>
            <p className="menu-item-description">{menuItem.description}</p>
            {menuItem.is_available === false ? (
                <button type="button" className="add-to-cart-btn" disabled>{t('menuItemUnavailable')}</button>
            ) : handleIsLoginIsInCart}
        </li>
    );
}

export default MenuItem;