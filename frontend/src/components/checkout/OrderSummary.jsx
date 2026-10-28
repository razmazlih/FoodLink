import { useNavigate, useParams } from 'react-router-dom';
import { updateCartStatus } from '../../services/OrderLine/status/api';
import { CartContext } from '../../context/CartContext';
import { saveDeliveryAddress } from '../../services/OrderLine/order/api';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';

function OrderSummary({ totalPrice, myOrder, deliveryAddress }) {
    const { t } = useTranslation();
    const { orderId } = useParams();
    const { updateCart } = useContext(CartContext);
    const navigate = useNavigate();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const handleCheckout = async () => {
        if (busy || !deliveryAddress) return;
        setBusy(true); setError('');
        try {
            const { city, street_name, house_number, label } = deliveryAddress;
            await saveDeliveryAddress(orderId, { city, street_name, house_number, label });
            await updateCartStatus(orderId, 'active');
            updateCart([], '');
            navigate('/my-orders');
        } catch { setError(t('checkoutError')); }
        finally { setBusy(false); }
    };

    const handleContinueCart = (inNavigate) => {
        updateCart(myOrder.items, myOrder.id);
        navigate(inNavigate);
    };

    return (
        <div className="order-checkout-summary-container">
            {error && <p role="alert">{error}</p>}
            {!deliveryAddress && <p>{t('chooseDeliveryAddress')}</p>}
            <h4 className="order-checkout-summary-total">
                {t('total')}: {totalPrice > 0 ? totalPrice : 0}₪
            </h4>
            {totalPrice > 0 && (
                <button
                    className="order-checkout-button-checkout"
                    disabled={busy || !deliveryAddress}
                    onClick={handleCheckout}
                >
                    {t('pay')}
                </button>
            )}
            <button
                className="order-checkout-button-continue"
                disabled={busy}
                onClick={() => handleContinueCart(`/restaurants/${myOrder.restaurantId}`)}
            >
                {t('continueOrdering')}
            </button>
        </div>
    );
}

export default OrderSummary;