import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext';
import CartTemplate from './CartTemplate';
import './CartNavbar.css';
import { useNavigate, useLocation } from 'react-router-dom';

function CartNavbar() {
    const { t } = useTranslation();
    const { cart, setShowing, orderId } = useContext(CartContext);
    const navigate = useNavigate();
    const location = useLocation();

    const handleClickCheckout = () => {
        setShowing(false);
        navigate(`/my-orders/checkout/${orderId}`);
    };

    return (
        <div className="cart-navbar">
            <h2 className="cart-navbar-title">{t('myCart')}</h2>
            {!cart.length && (
                <p className="cart-navbar-pas">{t('emptyCart')}</p>
            )}

            <div className="cart-items-container">
                {cart.map((item) => (
                    <CartTemplate key={item.id} item={item} />
                ))}
            </div>
            {cart.length > 0 && !location.pathname.includes('/checkout') && (
                <button
                    className="cart-button"
                    onClick={() => handleClickCheckout()}
                >
                    {t('checkout')}
                </button>
            )}
            <button className="cart-button" onClick={() => setShowing(false)}>
                {t('close')}
            </button>
        </div>
    );
}

export default CartNavbar;