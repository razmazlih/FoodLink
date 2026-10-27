import React, { useState } from 'react';
import './styles/MenuItemEditor.css';

function MenuItemEditor({ item, categoryId, handleMenuItemUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState(item);

    const handleEditClick = () => {
        setIsEditing(true);
    };

    const handleSaveClick = () => {
        handleMenuItemUpdate(categoryId, item.id, editedItem);
        setIsEditing(false);
    };

    const handleCancelClick = () => {
        setEditedItem(item);
        setIsEditing(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditedItem({
            ...editedItem,
            [name]: value,
        });
    };

    return (
        <li className="menu-item-editor">
            {isEditing ? (
                <>
                    <input
                        className="menu-item-editor__input"
                        type="text"
                        name="name"
                        value={editedItem.name}
                        onChange={handleChange}
                        placeholder="Item Name"
                    />
                    <input
                        className="menu-item-editor__input"
                        type="number"
                        name="price"
                        value={editedItem.price}
                        onChange={handleChange}
                        placeholder="Price"
                        min="0"
                    />
                    <input
                        className="menu-item-editor__input"
                        type="text"
                        name="description"
                        value={editedItem.description}
                        onChange={handleChange}
                        placeholder="Description"
                    />
                    <button
                        className="menu-item-editor__save-button"
                        onClick={handleSaveClick}
                    >
                        Save
                    </button>
                    <button
                        className="menu-item-editor__cancel-button"
                        onClick={handleCancelClick}
                    >
                        Cancel
                    </button>
                </>
            ) : (
                <>
                    <span className="menu-item-editor__name">
                        {item.name}
                    </span>{' '}
                    -{' '}
                    <span className="menu-item-editor__price">
                        ₪{item.price}
                    </span>
                    <p className="menu-item-editor__description">
                        {item.description}
                    </p>
                    <button
                        className="menu-item-editor__edit-button"
                        onClick={handleEditClick}
                    >
                        Edit
                    </button>
                </>
            )}
        </li>
    );
}

export default MenuItemEditor;