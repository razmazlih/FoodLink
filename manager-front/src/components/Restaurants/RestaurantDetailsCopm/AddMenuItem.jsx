import React, { useState } from 'react';
import './styles/AddMenuItem.css';

function AddMenuItem({ handleAddMenuItem }) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [open, setOpen] = useState(false);

    const handleSubmit = () => {
        handleAddMenuItem({ name, price, description });
        setName('');
        setPrice('');
        setDescription('');
    };

    return open ?(
        <div className="add-menu-item-container">
            <h4 className="add-menu-item-title">Add New Menu Item</h4>
            <input
                type="text"
                className="add-menu-item-input add-menu-item-name"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <input
                type="text"
                className="add-menu-item-input add-menu-item-price"
                placeholder="Price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
            />
            <input
                type="text"
                className="add-menu-item-input add-menu-item-description"
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
            <button className="add-menu-item-button" onClick={handleSubmit}>
                Add Item
            </button>
            <button className="add-menu-item-button" onClick={() => setOpen(false)}>
                close
            </button>
        </div>
    ) : <button className='add-menu-item-button' onClick={() => setOpen(true)}>open</button>;
}

export default AddMenuItem;