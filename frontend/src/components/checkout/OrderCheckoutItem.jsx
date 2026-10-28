import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readMenuItemNames, resolveMenuItemNames } from '../../services/DishBoard/menu/names';

function OrderCheckoutItem({ items }) {
    const { t } = useTranslation();
    const [mapItemName, setMapItemName] = useState(
        readMenuItemNames()
    );

    useEffect(() => {
        let active = true;
        resolveMenuItemNames(items).then((names) => {
            if (active) setMapItemName({ ...readMenuItemNames(), ...names });
        }).catch((error) => console.error('Error fetching menu item names:', error));
        return () => { active = false; };
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