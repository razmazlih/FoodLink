import { notify } from '../Feedback/Feedback';
import React, { useState, useEffect } from 'react';
import { fetchManagerOrders, setManagerOrderStatus } from '../../services/api';
import './OrdersList.css';
import { useNavigate } from 'react-router-dom';

function OrdersList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleUpdateStatus = async (id) => {
    try {
      await setManagerOrderStatus(id, 'delivered');
      setOrders((current) => current.map((order) => order.id === id ? { ...order, status: 'delivered' } : order));
    } catch {
      notify('Failed to update order status.');
    }
  };

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetchManagerOrders();
        setOrders(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch orders.');
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) {
    return <div className="orders-loading">Loading orders...</div>;
  }

  if (error) {
    return <div className="orders-error">{error}</div>;
  }

  return (
    <div className="orders-list-container">
      <span className="eyebrow">FROM KITCHEN TO DOOR</span>
      <h1>Orders</h1>
      <p className="page-description">Keep every order moving, from preparation to delivery.</p>
      <table className="orders-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Restaurant</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 && <tr><td data-label="ID" colSpan={6} className="table-empty">No orders yet. New orders will appear here.</td></tr>}
          {orders.map((order) => (
            <tr key={order.id}>
              <td data-label="User">{order.id}</td>
              <td data-label="Restaurant">{order.user}</td>
              <td data-label="Total">{order.restaurant}</td>
              <td data-label="Status">${order.total.toFixed(2)}</td>
              <td data-label="Actions"><span className={`status-badge status-badge--${order.status}`}>{order.status}</span></td>
              <td>
                <button onClick={() => navigate(`/orders/${order.id}`)}>View</button>
                <button disabled={order.status !== 'active'} onClick={() => handleUpdateStatus(order.id)}>Mark Delivered</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OrdersList;
