import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import apiService from '../services/api';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchCartItems();
    }
  }, [currentUser]);

  const fetchCartItems = async () => {
    try {
      const result = await apiService.getCart();
      if (result.success) {
        // Handle the new backend response structure
        const cartData = result.data;
        if (cartData && cartData.items) {
          // Transform cart items to match frontend expectations
          const transformedItems = cartData.items.map(cartItem => ({
            _id: cartItem.itemId._id,
            id: cartItem.itemId._id,
            title: cartItem.itemId.title,
            name: cartItem.itemId.title, // For backward compatibility
            price: cartItem.itemId.price,
            images: cartItem.itemId.images,
            seller: cartItem.itemId.seller,
            quantity: cartItem.quantity,
            addedAt: cartItem.addedAt
          }));
          setCartItems(transformedItems);
        } else {
          setCartItems([]);
        }
      } else {
        console.error('Error fetching cart:', result.error);
        setCartItems([]);
      }
    } catch (error) {
      console.error('Error fetching cart items:', error);
      setCartItems([]);
    }
  };

  const addToCart = async (item) => {
    try {
      const result = await apiService.addToCart(item._id || item.id);
      if (result.success) {
        // Refresh cart items from server to get updated data
        await fetchCartItems();
      } else {
        console.error('Error adding to cart:', result.error);
        // Show user-friendly error message
        alert(`Failed to add item to cart: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart. Please try again.');
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      const result = await apiService.removeFromCart(itemId);
      if (result.success) {
        // Refresh cart items from server to get updated data
        await fetchCartItems();
      } else {
        console.error('Error removing from cart:', result.error);
        alert(`Failed to remove item from cart: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      alert('Failed to remove item from cart. Please try again.');
    }
  };

  const clearCart = async () => {
    try {
      const result = await apiService.clearCart();
      if (result.success) {
        setCartItems([]);
      } else {
        console.error('Error clearing cart:', result.error);
        alert(`Failed to clear cart: ${result.error}`);
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      alert('Failed to clear cart. Please try again.');
    }
  };

  const updateItemQuantity = async (itemId, quantity) => {
    try {
      const result = await apiService.updateCartItemQuantity(itemId, quantity);
      if (result.success) {
        // Refresh cart items from server to get updated data
        await fetchCartItems();
      } else {
        console.error('Error updating item quantity:', result.error);
        alert(`Failed to update item quantity: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating item quantity:', error);
      alert('Failed to update item quantity. Please try again.');
    }
  };

  return (
    <CartContext.Provider value={{ 
      cartItems, 
      addToCart, 
      removeFromCart, 
      clearCart,
      updateItemQuantity,
      fetchCartItems 
    }}>
      {children}
    </CartContext.Provider>
  );
};
