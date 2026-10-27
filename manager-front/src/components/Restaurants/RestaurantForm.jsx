import React, { useState } from 'react';
import { dashboardApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import './RestaurantForm.css';

function RestaurantForm() {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newRestaurantData = { name, city, address };

      const { data } = await dashboardApi.post('/restaurants/info/', newRestaurantData);
      navigate(`/restaurant/${data.id}`);
    } catch (error) {
      console.error('Error adding restaurant:', error);
      alert('Failed to add restaurant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="restaurant-form__container">
      <h2 className="restaurant-form__title">Add New Restaurant</h2>
      <form onSubmit={handleSubmit} className="restaurant-form__form">
        <div className="restaurant-form__field">
          <label htmlFor="name" className="restaurant-form__label">Name:</label>
          <input
            id="name"
            type="text"
            placeholder="Enter restaurant name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="restaurant-form__input"
            required
          />
        </div>
        <div className="restaurant-form__field">
          <label htmlFor="city" className="restaurant-form__label">City:</label>
          <input
            id="city"
            type="text"
            placeholder="Enter city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="restaurant-form__input"
            required
          />
        </div>
        <div className="restaurant-form__field">
          <label htmlFor="address" className="restaurant-form__label">Address:</label>
          <input
            id="address"
            type="text"
            placeholder="Enter address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="restaurant-form__input"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="restaurant-form__button"
        >
          {loading ? 'Saving...' : 'Add Restaurant'}
        </button>
      </form>
    </div>
  );
}

export default RestaurantForm;