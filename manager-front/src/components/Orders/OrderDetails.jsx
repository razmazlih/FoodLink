import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchManagerOrder } from '../../services/api';
import './OrderDetails.css';

function OrderDetails() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await fetchManagerOrder(orderId);
        setOrder(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch order details.');
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId]);

  if (loading) {
    return <div className="order-loading">Loading order details...</div>;
  }

  if (error) {
    return <div className="order-error">{error}</div>;
  }

  return (
    <div className="order-details-container">
      <span className="eyebrow">EVERY DETAIL IN ONE PLACE</span>
      <h1>Order details</h1>
      <div className="order-metadata">
      <p><strong>Order ID:</strong> {order.id}</p>
      <p><strong>User:</strong> {order.user}</p>
      <p><strong>Restaurant:</strong> {order.restaurant}</p>
      <p><strong>Total:</strong> ${order.total.toFixed(2)}</p>
      <p><strong>Status:</strong> <span className={`status-badge status-badge--${order.status}`}>{order.status}</span></p>
      </div>
      {order.delivery_address && (
        <section className="order-delivery-address" aria-labelledby="delivery-address-title">
          <h2 id="delivery-address-title">Delivery address</h2>
          <address dir="auto">
            {order.delivery_address.label && <strong>{order.delivery_address.label}<br /></strong>}
            {order.delivery_address.street_name} {order.delivery_address.house_number}, {order.delivery_address.city}
          </address>
        </section>
      )}
      <h2>What’s in the order</h2>
      <ul>
        {order.items.map((item) => (
          <li key={item.id}><span>{item.name}</span><strong>${item.price.toFixed(2)}</strong></li>
        ))}
      </ul>
    </div>
  );
}

export default OrderDetails;
