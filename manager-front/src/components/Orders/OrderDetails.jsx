import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './OrderDetails.css';

function OrderDetails() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/orders/${orderId}`);
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
      <h1>Order Details</h1>
      <p><strong>Order ID:</strong> {order.id}</p>
      <p><strong>User:</strong> {order.user}</p>
      <p><strong>Restaurant:</strong> {order.restaurant}</p>
      <p><strong>Total:</strong> ${order.total.toFixed(2)}</p>
      <p><strong>Status:</strong> {order.status}</p>
      <h2>Items:</h2>
      <ul>
        {order.items.map((item) => (
          <li key={item.id}>{item.name} - ${item.price.toFixed(2)}</li>
        ))}
      </ul>
    </div>
  );
}

export default OrderDetails;