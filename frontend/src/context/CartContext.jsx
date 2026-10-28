import React, { createContext, useState, useEffect } from 'react';
import { createOrder, fetchOrder } from '../services/OrderLine/order/api';
import {
    addItemToCart,
    deleteItemFromCart,
    updateQuantityById,
} from '../services/OrderLine/order_items/api';

export const CartContext = createContext();

export const CartContextProvider = ({ children }) => {
    const [orderId, setOrderId] = useState(
        localStorage.getItem('orderId') || ''
    );
    const [cart, setCart] = useState(
        JSON.parse(localStorage.getItem('cartItems')) || []
    );
    const [showing, setShowing] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchOrder(orderId)
                .then((fullOrder) => fullOrder.items)
                .then((cartItems) => setCart(cartItems))
                .catch(() => {
                    setOrderId('');
                    localStorage.setItem('orderId', '');
                });
        }
    }, [orderId]);

    const addToCart = (item) => {
        const newOrderItem = {
            orderId: orderId,
            menuItemId: item.id,
            quantity: 1,
            price: item.price,
        };

        addItemToCart(newOrderItem)
            .then((responeData) => {
                const editedResponse = {
                    id: responeData.id,
                    orderId: responeData.order_id,
                    menu_item_id: responeData.menu_item_id,
                    name: responeData.name || item.name,
                    price: responeData.price,
                    quantity: responeData.quantity,
                };
                const newCart = [...cart, editedResponse];
                setCart(newCart);
                localStorage.setItem('cartItems', JSON.stringify(newCart));
            })
            .catch((error) => {
                console.error('Error adding item to cart:', error);
            });
    };

    const updateQuantity = async (itemId, newQuantity) => {
        await updateQuantityById(itemId, newQuantity);
        let newItem;
        const updatedCart = cart.map((item) => {
            if (item.id === itemId) {
                newItem = { ...item, quantity: newQuantity };
                return newItem;
            }
            return item;
        });
        setCart(updatedCart);
        localStorage.setItem('cartItems', JSON.stringify(updatedCart));
        return newItem;
    };

    const removeFromCart = async (showItem) => {
        try {
            if (showItem.quantity === 1) {
                await deleteItemFromCart(showItem.id);

                const updatedCart = cart.filter(
                    (item) => item.id !== showItem.id
                );
                setCart(updatedCart);
                localStorage.setItem('cartItems', JSON.stringify(updatedCart));
                updatedCart.length === 0 && setShowing(false);
            } else {
                return await updateQuantity(showItem.id, showItem.quantity - 1);
            }
        } catch (error) {
            console.error('Error updating the cart:', error);
        }
    };

    const updateCart = (items, newOrderId) => {
        setOrderId(newOrderId);
        setCart(items);
        localStorage.setItem('orderId', newOrderId);
        localStorage.setItem('cartItems', JSON.stringify(items));
    };

    
    const createNewCart = async (userId, restaurantId) => {
        const order = await createOrder(userId, restaurantId);

        // Update both React state and localStorage together.
        updateCart([], order.id);

        // Return only after the server successfully creates the order.
        return order;
    };


    const checkInCart = (menuItemId) => {
        return cart.some((item) => item.menu_item_id === menuItemId);
    };

    return (
        <CartContext.Provider
            value={{
                orderId,
                cart,
                addToCart,
                removeFromCart,
                showing,
                setShowing,
                updateCart,
                createNewCart,
                updateQuantity,
                checkInCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};
