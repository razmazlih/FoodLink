import { notify } from '../Feedback/Feedback';
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
            notify('Failed to update restaurant info.');
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
            notify('Failed to update opening hours.');
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
            notify('Failed to update category.');
        }
    };

    const handleMenuItemUpdate = async (categoryId, itemId, updatedItem) => {
        try {
            const { name, price, description, is_available } = updatedItem;
            const response = await dashboardApi.patch(`/menu/item/${itemId}/`, { name, price, description, is_available });
            setMenu((prevMenu) =>
                prevMenu.map((category) =>
                    category.id === categoryId
                        ? {
                              ...category,
                              items: category.items.map((item) =>
                                  item.id === itemId ? response.data : item
                              ),
                          }
                        : category
                )
            );
        } catch (err) {
            notify('Failed to update menu item.');
        }
    };

    const handleMenuItemAdded = (categoryId, item) => {
        setMenu((current) => current.map((category) => category.id === categoryId
            ? { ...category, items: [...category.items, item] } : category));
    };

    const handleCreateCategory = async (name) => {
        try {
            const response = await dashboardApi.post(`/menu/category/`, {
                name: name,
                restaurant: restaurantId,
            });
            setMenu((prevMenu) => [...prevMenu, response.data]);
        } catch (err) {
            notify('Failed to create category.');
        }
    };

    if (loading) {
        return <div className="restaurant-details-loading" role="status">Loading your restaurant workspace…</div>;
    }

    if (error) {
        return <div className="restaurant-details-error" role="alert">{error}</div>;
    }

    return (
        <div className="restaurant-details-container">
            <header className="restaurant-workspace-heading"><span className="eyebrow">RESTAURANT WORKSPACE</span><h1>{editName || 'Your restaurant'}</h1><p className="page-description">The details, opening hours, and dishes that make it yours.</p></header>
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
                <h2>Your menu</h2>
                <p className="editor-description">Organize your dishes into categories. Keep names, prices, and descriptions up to date.</p>
                {menu.map((category) => (
                    <MenuCategory
                        key={category.id}
                        category={category}
                        handleUpdateCategory={handleUpdateCategory}
                        handleMenuItemUpdate={handleMenuItemUpdate}
                        handleMenuItemAdded={handleMenuItemAdded}
                    />
                ))}
                <div className="add-category">
                    <input
                        type="text"
                        aria-label="New category name"
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
