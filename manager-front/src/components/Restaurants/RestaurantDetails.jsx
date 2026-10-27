import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dashboardApi } from '../../services/api';
import './RestaurantDetails.css';
import MenuCategory from './RestaurantDetailsCopm/MenuCategory';
import EditRestaurantInfo from './RestaurantDetailsCopm/EditRestaurantInfo';
import OpeningHoursEditor from './RestaurantDetailsCopm/OpeningHoursEditor';

function RestaurantDetails() {
    const { restaurantId } = useParams();
    const [menu, setMenu] = useState([]);
    const [openingHours, setOpeningHours] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // States for editing
    const [editName, setEditName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editPhoto, setEditPhoto] = useState('');
    const [photoUrl, setPhotoUrl] = useState(''); 

    const [newCategoryName, setNewCategoryName] = useState('');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const restaurantResponse = await dashboardApi.get(
                    `/restaurants/info/${restaurantId}`
                );
                setEditName(restaurantResponse.data.name);
                setEditCity(restaurantResponse.data.city);
                setEditAddress(restaurantResponse.data.address);
                setPhotoUrl(restaurantResponse.data.photo_url);

                const menuResponse = await dashboardApi.get(
                    `/menu/category/?restaurant_id=${restaurantId}`
                );
                setMenu(menuResponse.data);

                const hoursResponse = await dashboardApi.get(
                    `/restaurants/opening-houers/?restaurant_id=${restaurantId}`
                );
                setOpeningHours(hoursResponse.data);
            } catch (err) {
                setError('Failed to fetch data.');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [restaurantId]);

    const handleUpdateRestaurantInfo = async () => {
        const formData = new FormData();
        formData.append('name', editName);
        formData.append('city', editCity);
        formData.append('address', editAddress);
        if (editPhoto) formData.append('photo', editPhoto);
    
        try {
            const {data} = await dashboardApi.patch(`/restaurants/info/${restaurantId}/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setPhotoUrl(data.photo_url);
        } catch (err) {
            alert('Failed to update restaurant info.');
        }
    };

    const handleUpdateHours = async (days) => {
        try {
            for (const day of days) {
                await dashboardApi.patch(
                    `/restaurants/opening-houers/${day.id}/?restaurant_id=${restaurantId}`,
                    {
                        is_open: day.is_open,
                        opening_time: day.opening_time,
                        closing_time: day.closing_time,
                    }
                );
            }
            setOpeningHours(days);
        } catch (err) {
            alert('Failed to update opening hours.');
        }
    };

    const handleUpdateCategory = async (categoryId, updatedCategory) => {
        try {
            await dashboardApi.patch(
                `/menu/category/${categoryId}/`,
                updatedCategory
            );
            setMenu((prevMenu) =>
                prevMenu.map((category) =>
                    category.id === categoryId
                        ? { ...category, ...updatedCategory }
                        : category
                )
            );
        } catch (err) {
            alert('Failed to update category.');
        }
    };

    const handleMenuItemUpdate = async (categoryId, itemId, updatedItem) => {
        try {
            await dashboardApi.patch(`/menu/item/${itemId}/`, updatedItem);
            setMenu((prevMenu) =>
                prevMenu.map((category) =>
                    category.id === categoryId
                        ? {
                              ...category,
                              items: category.items.map((item) =>
                                  item.id === itemId ? updatedItem : item
                              ),
                          }
                        : category
                )
            );
        } catch (err) {
            alert('Failed to update menu item.');
        }
    };

    const handleCreateCategory = async (name) => {
        try {
            const response = await dashboardApi.post(`/menu/category/`, {
                name: name,
                restaurant: restaurantId,
            });
            setMenu((prevMenu) => [...prevMenu, response.data]);
        } catch (err) {
            alert('Failed to create category.');
        }
    };

    if (loading) {
        return <div>Loading data...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className="restaurant-details-container">
            <EditRestaurantInfo
                editName={editName}
                setEditName={setEditName}
                editCity={editCity}
                editPhoto={editPhoto}
                photoUrl={photoUrl}
                setEditCity={setEditCity}
                editAddress={editAddress}
                setEditAddress={setEditAddress}
                setEditPhoto={setEditPhoto}
                handleUpdateRestaurantInfo={handleUpdateRestaurantInfo}
            />

            <OpeningHoursEditor
                openingHours={openingHours}
                onSave={handleUpdateHours}
            />

            <div className="menu-container">
                <h2>Edit Menu</h2>
                {menu.map((category) => (
                    <MenuCategory
                        key={category.id}
                        category={category}
                        handleUpdateCategory={handleUpdateCategory}
                        handleMenuItemUpdate={handleMenuItemUpdate}
                    />
                ))}
                <div className="add-category">
                    <input
                        type="text"
                        placeholder="New category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <button
                        onClick={() => {
                            if (newCategoryName.trim()) {
                                handleCreateCategory(newCategoryName);
                                setNewCategoryName('');
                            }
                        }}
                    >
                        Create Category
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RestaurantDetails;
