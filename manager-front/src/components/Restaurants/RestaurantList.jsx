import React, { useEffect, useState } from 'react';
import { dashboardApi } from '../../services/api';
import './RestaurantList.css';
import { useNavigate } from 'react-router-dom';

function RestaurantList() {
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await dashboardApi.get('/restaurants/info/');
        setRestaurants(response.data);
        setFilteredRestaurants(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch restaurants.');
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const handleSearchChange = (event) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);
    setFilteredRestaurants(
      restaurants.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(term) ||
        restaurant.address.toLowerCase().includes(term) ||
        restaurant.city.toLowerCase().includes(term)
      )
    );
  };

  const handleRowClick = (id) => {
    navigate(`/restaurants/${id}`);
  };

  const handleCreateNewRestaurant = () => {
    navigate('/restaurants/create');
  };

  if (loading) {
    return <div className="restaurant-list__loading">Loading restaurants...</div>;
  }

  if (error) {
    return <div className="restaurant-list__error">{error}</div>;
  }

  return (
    <div className="restaurant-list">
      <h1 className="restaurant-list__title">Restaurants</h1>
      <div className="restaurant-list__controls">
        <input
          type="text"
          placeholder="Search by name, address, or city"
          value={searchTerm}
          onChange={handleSearchChange}
          className="restaurant-list__search"
        />
        <button onClick={handleCreateNewRestaurant} className="restaurant-list__button">
          Create New Restaurant
        </button>
      </div>
      <table className="restaurant-list__table">
        <thead className="restaurant-list__thead">
          <tr className="restaurant-list__header-row">
            <th className="restaurant-list__header">ID</th>
            <th className="restaurant-list__header">Name</th>
            <th className="restaurant-list__header">Address</th>
          </tr>
        </thead>
        <tbody className="restaurant-list__tbody">
          {filteredRestaurants.map((restaurant) => (
            <tr
              key={restaurant.id}
              onClick={() => handleRowClick(restaurant.id)}
              className="restaurant-list__row"
            >
              <td className="restaurant-list__cell">{restaurant.id}</td>
              <td className="restaurant-list__cell">{restaurant.name}</td>
              <td className="restaurant-list__cell">{restaurant.address}, {restaurant.city}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RestaurantList;