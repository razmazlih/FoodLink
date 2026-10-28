import React, { useState } from 'react';
import './styles/EditRestaurantInfo.css';

function EditRestaurantInfo({
    editName,
    setEditName,
    editCity,
    photoUrl,
    setEditCity,
    editAddress,
    setEditAddress,
    setEditPhoto,
    handleUpdateRestaurantInfo,
}) {
    const [isEditing, setIsEditing] = useState(false);

    const handleEditClick = () => {
        setIsEditing(true);
    };

    const handleSaveClick = () => {
        handleUpdateRestaurantInfo();
        setIsEditing(false);
    };

    return (
        <div className="edit-restaurant-info-container">
            <h2 className="edit-restaurant-info-title">Restaurant details</h2>
            {isEditing ? (
                <>
                    <label className="field-label" htmlFor="restaurant-edit-name">Restaurant name</label>
                    <input
                        id="restaurant-edit-name"
                        type="text"
                        className="edit-restaurant-info-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Restaurant Name"
                    />
                    <label className="field-label" htmlFor="restaurant-edit-city">City</label>
                    <input
                        id="restaurant-edit-city"
                        type="text"
                        className="edit-restaurant-info-input"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        placeholder="City"
                    />
                    <label className="field-label" htmlFor="restaurant-edit-address">Street address</label>
                    <input
                        id="restaurant-edit-address"
                        type="text"
                        className="edit-restaurant-info-input"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="Address"
                    />
                    <label className="field-label" htmlFor="restaurant-edit-photo">Restaurant photo</label>
                    <input
                        id="restaurant-edit-photo"
                        accept="image/*"
                        type="file"
                        className="edit-restaurant-info-input"
                        onChange={(e) => setEditPhoto(e.target.files[0])}
                    />
                    <button
                        className="edit-restaurant-info-save-button"
                        onClick={handleSaveClick}
                    >
                        Save details
                    </button>
                </>
            ) : (
                <>
                    <p className="edit-restaurant-info-text">
                        <strong>Name:</strong> {editName}
                    </p>
                    <p className="edit-restaurant-info-text">
                        <strong>City:</strong> {editCity}
                    </p>
                    <p className="edit-restaurant-info-text">
                        <strong>Address:</strong> {editAddress}
                    </p>
                    {photoUrl ? <img className="edit-restaurant-info-photo" src={photoUrl} alt={editName} /> : <div className="restaurant-photo-placeholder"><span aria-hidden="true">＋</span><p>Add a photo to help your restaurant stand out.</p></div>}
                    <button
                        className="edit-restaurant-info-edit-button"
                        onClick={handleEditClick}
                    >

                        Edit details
                    </button>
                </>
            )}
        </div>
    );
}

export default EditRestaurantInfo;
