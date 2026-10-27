import './RestaurantInfo.css';

function RestaurantInfo({ restaurant }) {
    return (
        <div className="restaurant-info">
            <h2>{restaurant.name}</h2>
            <h3>
                {restaurant.address}, {restaurant.city}
            </h3>
        </div>
    );
}

export default RestaurantInfo;