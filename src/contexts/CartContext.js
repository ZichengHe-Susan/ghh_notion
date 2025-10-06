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
      console.log('=== CART CONTEXT - fetchCartItems called ===');
      const result = await apiService.getCart();
      console.log('Raw cart API result:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        // Handle the new backend response structure
        const cartData = result.data;
        console.log('Cart data:', JSON.stringify(cartData, null, 2));
        
        if (cartData && cartData.items) {
          console.log('Cart items count:', cartData.items.length);
          
          // Transform cart items to match frontend expectations
          const transformedItems = cartData.items.map((cartItem, index) => {
            console.log(`Cart item ${index}:`, JSON.stringify(cartItem, null, 2));
            console.log(`Cart item ${index} shipping:`, JSON.stringify(cartItem.shipping, null, 2));
            console.log(`Cart item ${index} itemId.shipping:`, JSON.stringify(cartItem.itemId?.shipping, null, 2));
            
            return {
              _id: cartItem.itemId._id,
              id: cartItem.itemId._id,
              title: cartItem.itemId.title,
              name: cartItem.itemId.title, // For backward compatibility
              price: cartItem.itemId.price,
              images: cartItem.itemId.images,
              seller: cartItem.itemId.seller,
              quantity: cartItem.quantity,
              deliveryMethod: cartItem.deliveryMethod,
              shipping: cartItem.shipping || cartItem.itemId.shipping, // Use cart item shipping first, fallback to item shipping
              addedAt: cartItem.addedAt
            };
          });
          
          console.log('Transformed cart items:', JSON.stringify(transformedItems, null, 2));
          setCartItems(transformedItems);
        } else {
          console.log('No cart items found');
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
      console.log('=== CART CONTEXT - addToCart called ===');
      console.log('Full item object:', JSON.stringify(item, null, 2));
      console.log('Item ID:', item._id || item.id);
      console.log('Item shipping object:', JSON.stringify(item.shipping, null, 2));
      console.log('Item shipping methods:', item.shipping?.shippingMethods);
      
      const result = await apiService.addToCart(item._id || item.id, item.shipping);
      console.log('API service result:', result);
      
      if (result.success) {
        console.log('Successfully added to cart, refreshing cart items...');
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

  const updateItem = async (itemId, quantity, deliveryMethod) => {
    try {
      const result = await apiService.updateCartItem(itemId, quantity, deliveryMethod);
      if (result.success) {
        // Refresh cart items from server to get updated data
        await fetchCartItems();
      } else {
        console.error('Error updating item:', result.error);
        alert(`Failed to update item: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item. Please try again.');
    }
  };

  return (
    <CartContext.Provider value={{ 
      cartItems, 
      addToCart, 
      removeFromCart, 
      clearCart,
      updateItem,
      fetchCartItems 
    }}>
      {children}
    </CartContext.Provider>
  );
};
