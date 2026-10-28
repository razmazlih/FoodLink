import React, { useId, useState } from 'react';
import './styles/AddMenuItem.css';

function AddMenuItem({ handleAddMenuItem }) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [open, setOpen] = useState(false);
    const fieldId = useId();

    const handleSubmit = (event) => {
        event.preventDefault();
        handleAddMenuItem({ name, price, description });
        setName('');
        setPrice('');
        setDescription('');
    };

    return open ? (
        <form className="add-menu-item-container" onSubmit={handleSubmit}>
            <h4 className="add-menu-item-title">Add a menu item</h4>
            <p className="editor-description">Make something delicious easy to discover.</p>
            <label className="field-label" htmlFor={`${fieldId}-name`}>Item name</label>
            <input id={`${fieldId}-name`} type="text" className="add-menu-item-input" placeholder="e.g. Garden salad" value={name} onChange={(e) => setName(e.target.value)} required />
            <label className="field-label" htmlFor={`${fieldId}-price`}>Price (₪)</label>
            <input id={`${fieldId}-price`} type="number" min="0" step="0.01" className="add-menu-item-input" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
            <label className="field-label" htmlFor={`${fieldId}-description`}>Description</label>
            <textarea id={`${fieldId}-description`} className="add-menu-item-input" placeholder="Ingredients, flavors, and the little details." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            <div className="editor-actions">
                <button type="submit" className="add-menu-item-button">Add item</button>
                <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Close</button>
            </div>
        </form>
    ) : <button className="add-menu-item-button" onClick={() => setOpen(true)}>+ Add menu item</button>;
}

export default AddMenuItem;
