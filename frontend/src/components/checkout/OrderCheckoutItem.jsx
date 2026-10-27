import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMenuItemNameById } from '../../services/DishBoard/menu/api';

function OrderCheckoutItem({ items }) {
    const { t } = useTranslation();
    const [mapItemName, setMapItemName] = useState(
        JSON.parse(localStorage.getItem('cartNames')) || {}
    );

    useEffect(() => {
        const fetchDetailsForLoadingItems = async () => {
            const cartNames =
                JSON.parse(localStorage.getItem('cartNames')) || {};

            const itemsToFetch = items.filter(
                (item) => !cartNames[item.menu_item_id]
            );

            if (itemsToFetch.length === 0) return;

            const fetchedNames = {};
            try {
                for (const item of itemsToFetch) {
                    const response = await getMenuItemNameById(
                        item.menu_item_id
                    );
                    fetchedNames[item.menu_item_id] = response;
                }

                const updatedCartNames = { ...cartNames, ...fetchedNames };
                localStorage.setItem(
                    'cartNames',
                    JSON.stringify(updatedCartNames)
                );
                setMapItemName(updatedCartNames);
            } catch (error) {
                console.error('Error fetching menu item name:', error);
            }
        };

        fetchDetailsForLoadingItems();
    }, [items]);

    return (
        <div>
            {items.map((item) => (
                <div className="order-checkout-item-container" key={item.id}>
                    <p className="order-checkout-item-name">
                        {mapItemName[item.menu_item_id] || t('loading')} -{' '}
                        {Number(item.price)}₪{' '}
                        {item.quantity > 1 && `x ${item.quantity}`}
                    </p>
                </div>
            ))}
        </div>
    );
}

export default OrderCheckoutItem;