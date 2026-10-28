import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import { fetchDashboardStats } from '../../services/api';

function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRestaurants: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch statistics from the API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetchDashboardStats();
        setStats(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching stats:', error);
        setError(true);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  if (error) return <div className="dashboard-error" role="alert">Unable to load your business overview. Please refresh to try again.</div>;

  return (
    <div className="dashboard-container">
      <span className="eyebrow">YOUR WORKSPACE AT A GLANCE</span>
      <h1>Business overview</h1>
      <p className="page-description">A little clarity for your everyday operations.</p>
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
