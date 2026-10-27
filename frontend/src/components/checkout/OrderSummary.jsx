import { useNavigate, useParams } from 'react-router-dom';
import { updateCartStatus } from '../../services/OrderLine/status/api';
import { CartContext } from '../../context/CartContext';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

function OrderSummary({ totalPrice, myOrder }) {
    const { t } = useTranslation();
    const { orderId } = useParams();
    const { updateCart } = useContext(CartContext);
    const navigate = useNavigate();

    const handleCheckout = () => {
        updateCartStatus(orderId, 'active')
            .then(() => {
                updateCart([], '');
                navigate('/my-orders');
            })
            .catch((err) => {
                console.log(err);
            });
    };

    const handleContinueCart = (inNavigate) => {
        updateCart(myOrder.items, myOrder.id);
        navigate(inNavigate);
    };

    return (
        <div className="order-checkout-summary-container">
            <h4 className="order-checkout-summary-total">
                {t('total')}: {totalPrice > 0 ? totalPrice : 0}₪
            </h4>
            {totalPrice > 0 && (
                <button
                    className="order-checkout-button-checkout"
                    onClick={handleCheckout}
                >
                    {t('pay')}
                </button>
            )}
            <button
                className="order-checkout-button-continue"
                onClick={() => handleContinueCart(`/restaurants/${myOrder.restaurantId}`)}
            >
                {t('continueOrdering')}
            </button>
        </div>
    );
}

export default OrderSummary;