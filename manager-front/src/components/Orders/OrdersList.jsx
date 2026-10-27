import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OrdersList.css';

function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/orders`);
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
      <h1>Orders</h1>
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
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.user}</td>
              <td>{order.restaurant}</td>
              <td>${order.total.toFixed(2)}</td>
              <td>{order.status}</td>
              <td>
                <button onClick={() => handleViewDetails(order.id)}>View</button>
                <button onClick={() => handleUpdateStatus(order.id)}>Update Status</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const handleViewDetails = (id) => {
  // Navigate to details page or display a modal
  console.log(`Viewing details for order ${id}`);
};

const handleUpdateStatus = (id) => {
  // Logic to update the status
  console.log(`Updating status for order ${id}`);
};

export default OrdersList;