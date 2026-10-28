import React, { useId, useState } from 'react';
import './styles/MenuItemEditor.css';

function MenuItemEditor({ item, categoryId, handleMenuItemUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const fieldId = useId();
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
                    <label className="field-label" htmlFor={`${fieldId}-name`}> Item name</label>
                    <input
                        id={`${fieldId}-name`}
                        className="menu-item-editor__input"
                        type="text"
                        name="name"
                        value={editedItem.name}
                        onChange={handleChange}
                        placeholder="Item Name"
                    />
                    <label className="field-label" htmlFor={`${fieldId}-price`}> Price (₪)</label>
                    <input
                        id={`${fieldId}-price`}
                        className="menu-item-editor__input"
                        type="number"
                        name="price"
                        value={editedItem.price}
                        onChange={handleChange}
                        placeholder="Price"
                        min="0"
                        step="0.01"
                    />
                    <label className="field-label" htmlFor={`${fieldId}-description`}> Description</label>
                    <input
                        id={`${fieldId}-description`}
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