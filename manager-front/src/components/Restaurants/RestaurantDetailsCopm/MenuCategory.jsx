import React, { useState } from 'react';
import MenuItemEditor from './MenuItemEditor';
import AddMenuItem from './AddMenuItem';
import { dashboardApi } from '../../../services/api';
import './styles/MenuCategory.css';

function MenuCategory({
    category,
    handleUpdateCategory,
    handleMenuItemUpdate,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(category?.name || '');

    const handleAddMenuItem = async (item) => {
        try {
            const response = await dashboardApi.post(`/menu/item/`, {
                name: item.name,
                price: item.price,
                description: item.description,
                category: category.id,
            });

            handleUpdateCategory(category.id, {
                ...category,
                items: [...category.items, response.data],
            });
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <div className="menu-category">
            <h3 className="menu-category__title">
                {!isEditing ? (
                    <span className="menu-category__name">{category.name}</span>
                ) : (
                    <input
                        className="menu-category__input"
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                    />
                )}
            </h3>
            {!isEditing ? (
                <button
                    className="menu-category__edit-button"
                    onClick={() => setIsEditing(true)}
                >
                    Edit
                </button>
            ) : (
                <>
                    <button
                        className="menu-category__save-button"
                        onClick={() => {
                            handleUpdateCategory(category.id, {
                                name: editedName,
                            });
                            setIsEditing(false);
                        }}
                    >
                        Save
                    </button>
                    <button
                        className="menu-category__cancel-button"
                        onClick={() => setIsEditing(false)}
                    >
                        Cancel
                    </button>
                </>
            )}
            <ul className="menu-category__items">
                {category.items.map((item) => (
                    <MenuItemEditor
                        key={item.id}
                        item={item}
                        categoryId={category.id}
                        handleMenuItemUpdate={handleMenuItemUpdate}
                    />
                ))}
            </ul>
            <AddMenuItem
                categoryId={category.id}
                handleAddMenuItem={handleAddMenuItem}
            />
        </div>
    );
}

export default MenuCategory;