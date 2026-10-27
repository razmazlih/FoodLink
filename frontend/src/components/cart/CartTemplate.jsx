import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext';
import './CartTemplate.css';
import { getMenuItemNameById } from '../../services/DishBoard/menu/api';

function CartTemplate({ item }) {
    const { t } = useTranslation();
    const { removeFromCart, updateQuantity } = useContext(CartContext);
    const isRTL = document.documentElement.dir === 'rtl'; // בדיקה אם השפה היא עברית

    const [showItem, setShowItem] = useState({
        itemId: item.id,
        price: Number(item.price),
        quantity: item.quantity,
        name:
            JSON.parse(localStorage.getItem('cartNames'))?.[
                item.menu_item_id
            ] || t('loading'),
    });

    useEffect(() => {
        let isMounted = true;

        const updateLocalStorage = (menuItemId, name) => {
            const cartNames =
                JSON.parse(localStorage.getItem('cartNames')) || {};
            cartNames[menuItemId] = name;
            localStorage.setItem('cartNames', JSON.stringify(cartNames));
        };

        if (
            !JSON.parse(localStorage.getItem('cartNames'))?.[item.menu_item_id]
        ) {
            getMenuItemNameById(item.menu_item_id)
                .then((response) => {
                    if (isMounted && response) {
                        setShowItem((prev) => ({
                            ...prev,
                            name: response,
                        }));
                        updateLocalStorage(item.menu_item_id, response);
                    }
                })
                .catch((error) => {
                    console.error('Error fetching menu item name:', error);
                });
        } else {
            setShowItem((prev) => ({
                ...prev,
                name: JSON.parse(localStorage.getItem('cartNames'))[
                    item.menu_item_id
                ],
            }));
        }

        return () => {
            isMounted = false;
        };
    }, [item.menu_item_id]);

    const handleClickAdd = async () => {
        const updatedItem = await updateQuantity(item.id, item.quantity + 1);
        setShowItem((prev) => ({
            ...prev,
            quantity: updatedItem.quantity,
        }));
    };

    const handleClickRemove = async () => {
        const newItem = await removeFromCart(item);
        setShowItem((prev) => ({
            ...prev,
            quantity: newItem.quantity,
        }));
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
                        onClick={() => handleClickRemove()}
                    >
                        -
                    </button>
                    <button
                        className="cart-item-button"
                        onClick={() => handleClickAdd()}
                    >
                        +
                    </button>
                </div>
            ) : (
                <div>
                    <button
                        className="cart-item-button"
                        onClick={() => handleClickAdd()}
                    >
                        +
                    </button>
                    <button
                        className="cart-item-button"
                        onClick={() => handleClickRemove()}
                    >
                        -
                    </button>
                </div>
            )}
        </div>
    );
}

export default CartTemplate;
