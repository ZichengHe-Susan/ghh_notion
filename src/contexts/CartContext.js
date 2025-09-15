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
        setCartItems(result.data || []);
      } else {
        console.error('Error fetching cart:', result.error);
      }
    } catch (error) {
      console.error('Error fetching cart items:', error);
    }
  };

  const addToCart = async (item) => {
    try {
      const result = await apiService.addToCart(item._id || item.id);
      if (result.success) {
        setCartItems(currentItems => [...currentItems, item]);
      } else {
        console.error('Error adding to cart:', result.error);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      const result = await apiService.removeFromCart(itemId);
      if (result.success) {
        setCartItems(currentItems => currentItems.filter(item => item._id !== itemId && item.id !== itemId));
      } else {
        console.error('Error removing from cart:', result.error);
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  const clearCart = async () => {
    try {
      const result = await apiService.clearCart();
      if (result.success) {
        setCartItems([]);
      } else {
        console.error('Error clearing cart:', result.error);
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  return (
    <CartContext.Provider value={{ 
      cartItems, 
      addToCart, 
      removeFromCart, 
      clearCart,
      fetchCartItems 
    }}>
      {children}
    </CartContext.Provider>
  );
};
