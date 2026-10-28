import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext';
import './CartTemplate.css';
import { readMenuItemNames, resolveMenuItemName } from '../../services/DishBoard/menu/names';

function CartTemplate({ item }) {
    const { t } = useTranslation();
    const { removeFromCart, updateQuantity } = useContext(CartContext);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const isRTL = document.documentElement.dir === 'rtl'; // בדיקה אם השפה היא עברית

    const [showItem, setShowItem] = useState({
        itemId: item.id,
        price: Number(item.price),
        quantity: item.quantity,
        name:
            item.name || readMenuItemNames()[item.menu_item_id] || t('loading'),
    });

    useEffect(() => {
        let isMounted = true;

        resolveMenuItemName(item.menu_item_id)
            .then((name) => {
                if (isMounted && name) setShowItem((prev) => ({ ...prev, name }));
            })
            .catch((error) => console.error('Error fetching menu item name:', error));

        return () => {
            isMounted = false;
        };
    }, [item.menu_item_id]);

    const handleClickAdd = async () => {
        setBusy(true); setError(false);
        try {
            const updatedItem = await updateQuantity(item.id, item.quantity + 1);
            setShowItem((prev) => ({ ...prev, quantity: updatedItem.quantity }));
        } catch (error) {
            console.error('Error increasing cart quantity:', error);
            setError(true);
        } finally { setBusy(false); }
    };

    const handleClickRemove = async () => {
        setBusy(true); setError(false);
        try {
            const newItem = await removeFromCart(item);
            if (newItem) setShowItem((prev) => ({ ...prev, quantity: newItem.quantity }));
        } catch { setError(true); }
        finally { setBusy(false); }
    };

    if (!item) {
        return <div>{t('itemNotAvailable')}</div>;
    }

    return (
        <div className="cart-item">
            {isRTL ? (
                <div>
                    <span className="cart-item-span">
                        {showItem.quantity > 1 && `${showItem.quantity}X `}
                        {showItem.price + '₪'}

                    </span>
                    <strong className="cart-item-strong">
                        {showItem.name}
                    </strong>
                </div>
            ) : (
                <div>
                    <strong className="cart-item-strong">
                        {showItem.name}
                    </strong>
                    <span className="cart-item-span">
                        {showItem.price}₪{' '}
                        {showItem.quantity > 1 && ` x ${showItem.quantity}`}
                    </span>
                </div>
            )}

            {isRTL ? (
                <div>
                    <button
                        className="cart-item-button"
                        disabled={busy} aria-label={`${t('decreaseQuantity')}: ${showItem.name}`}
                        onClick={() => handleClickRemove()}
                    >
                        -
                    </button>
                    <button
                        className="cart-item-button"
                        disabled={busy} aria-label={`${t('increaseQuantity')}: ${showItem.name}`}
                        onClick={() => handleClickAdd()}
                    >
                        +
                    </button>
                </div>
            ) : (
                <div>
                    <button
                        className="cart-item-button"
                        disabled={busy} aria-label={`${t('increaseQuantity')}: ${showItem.name}`}
                        onClick={() => handleClickAdd()}
                    >
                        +
                    </button>
                    <button
                        className="cart-item-button"
                        disabled={busy} aria-label={`${t('decreaseQuantity')}: ${showItem.name}`}
                        onClick={() => handleClickRemove()}
                    >
                        -
                    </button>
                </div>
            )}
            {error && <p className="cart-item-error" role="alert">{t('orderActionFailed')}</p>}
        </div>
    );
}

export default CartTemplate;
