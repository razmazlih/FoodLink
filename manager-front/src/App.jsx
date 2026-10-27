import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import RestaurantsPage from './pages/RestaurantsPage';
import OrdersPage from './pages/OrdersPage';
import Navbar from './components/Navbar/Navbar';
import RestaurantDetails from './components/Restaurants/RestaurantDetails';
import RestaurantForm from './components/Restaurants/RestaurantForm';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/restaurants/:restaurantId" element={<RestaurantDetails />} />
        <Route path="/restaurants/create" element={<RestaurantForm />} />
        <Route path="/orders" element={<OrdersPage />} />
      </Routes>
    </Router>
  );
}

export default App;