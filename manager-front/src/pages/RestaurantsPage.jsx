import React, { useState } from 'react';
import RestaurantList from '../components/Restaurants/RestaurantList';
import RestaurantForm from '../components/Restaurants/RestaurantForm';

function RestaurantsPage() {
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const handleSuccess = () => {
    setSelectedRestaurant(null);
    window.location.reload();
  };

  return (
    <div>
      {selectedRestaurant ? (
        <RestaurantForm
          restaurantId={selectedRestaurant}
          onSuccess={handleSuccess}
        />
      ) : (
        <RestaurantList />
      )}
    </div>
  );
}

export default RestaurantsPage;