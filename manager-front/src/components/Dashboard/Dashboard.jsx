import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import axios from 'axios';

function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRestaurants: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  // Fetch statistics from the API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/dashboard/stats`);
        setStats(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching stats:', error);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <h1>Admin Dashboard</h1>
      <div className="dashboard-stats">
        <div className="stat-card">
          <h2>{stats.totalUsers}</h2>
          <p>Total Users</p>
        </div>
        <div className="stat-card">
          <h2>{stats.totalRestaurants}</h2>
          <p>Total Restaurants</p>
        </div>
        <div className="stat-card">
          <h2>{stats.totalOrders}</h2>
          <p>Total Orders</p>
        </div>
        <div className="stat-card">
          <h2>${stats.totalRevenue.toFixed(2)}</h2>
          <p>Total Revenue</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;