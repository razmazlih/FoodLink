import { useContext, useEffect, useRef } from 'react';
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
    const closeButton = useRef(null);
    const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

    useEffect(() => {
        const previous = document.activeElement;
        closeButton.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setShowing(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previous?.focus();
        };
    }, [setShowing]);

    const handleClickCheckout = () => {
        setShowing(false);
        navigate(`/my-orders/checkout/${orderId}`);
    };

    return (
        <section className="cart-navbar" role="dialog" aria-labelledby="cart-heading">
            <h2 id="cart-heading" className="cart-navbar-title">{t('myCart')}</h2>
            {!cart.length && (
                <div className="cart-empty-state"><span aria-hidden="true">↗</span><p className="cart-navbar-pas">{t('emptyCart')}</p><button className="cart-browse-button" onClick={() => { setShowing(false); navigate('/restaurants'); }}>{t('viewRestaurants')}</button></div>
            )}

            <div className="cart-items-container">
                {cart.map((item) => (
                    <CartTemplate key={item.id} item={item} />
                ))}
            </div>
            {cart.length > 0 && <div className="cart-total-row"><span>{t('cartTotal')}</span><strong>{total.toFixed(2)}₪</strong></div>}
            {cart.length > 0 && !location.pathname.includes('/checkout') && (
                <button
                    className="cart-button"
                    onClick={() => handleClickCheckout()}
                >
                    {t('checkout')}
                </button>
            )}
            <button ref={closeButton} className="cart-button cart-close-button" onClick={() => setShowing(false)}>
                {t('close')}
            </button>
        </section>
    );
}

export default CartNavbar;