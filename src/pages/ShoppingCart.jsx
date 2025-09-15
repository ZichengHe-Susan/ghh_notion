import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/ShoppingCart.css';
import defaultImage from '../assets/coming-soon.jpg';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import apiService from '../services/api';

const ShoppingCart = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { cartItems, removeFromCart, clearCart } = useCart();
    const [totalPrice, setTotalPrice] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) {
          navigate('/login');
        }
      }, [currentUser, navigate]);
    
    useEffect(() => {
        if (currentUser && cartItems) {
            const totalP = cartItems.reduce((acc, item) => acc + item.price, 0);
            setTotalPrice(totalP);
            setLoading(false);
        }
    }, [currentUser, cartItems]); 

    const removeItem = async (itemId) => {
        try {
            await removeFromCart(itemId);
        } catch (error) {
            console.error('Error removing item from cart:', error);
        }
    }
    
    const navigateHome = async () => {
        try {
            navigate('/');
        } catch (error) {
            console.error('Failed to navigate to homepage:', error);
        }
    }

    const handleCheckout = async () => {
        try {
            if(cartItems.length === 0) {
                alert('No items in cart');
                return;
            }
            
            const orderData = {
                items: cartItems,
                totalPrice: totalPrice,
                status: 'pending'
            };

            const result = await apiService.createOrder(orderData);
            if (result.success) {
                // Clear the cart after successful order
                await clearCart();
                
                navigate('/checkedOut', {
                    state: {
                        orderNumber: result.data.orderNumber || result.data._id,
                        items: cartItems,
                        totalPrice: totalPrice,
                        timestamp: new Date(),
                        status: 'pending'
                    }
                });
            } else {
                alert(`Checkout failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Error during checkout:', error);
            alert('Checkout failed. Please try again.');
        }
    }
    
    if (loading) {
        return (
            <div className="shopping-cart-wrapper">
                <div className="shopping-cart">
                    <h1 className="shopping-cart-title">Loading cart...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="shopping-cart-wrapper">
        <div className="shopping-cart">
            <h1 className="shopping-cart-title">Shopping Cart</h1>
            <button className = "back-button"onClick={navigateHome}>Back to Homepage</button>
            {cartItems.length > 0 ? (
                <ul className="cart-items">
                    {cartItems.map((item, index) => (
                        <li key={item._id || item.id} className="cart-item">
                            <div className="item-info">
                                <img src={(item.images && item.images[0]) || item.imageURL || defaultImage} alt={item.name} className='item-image' />
                                <span className="item-title">{item.name}</span>
                                <span className="item-price">${item.price}</span>
                            </div>
                            <div className="item-actions">
                                <button className="item-remove" onClick={() => removeItem(item._id || item.id)}>Remove</button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="empty-cart">
                    <p>Your cart is empty.</p>
                </div>
            )}
            <div className="cart-sum">
            <h2>Summary</h2>
                <div className="summary-details">
                    <p>Total</p>
                    <p>${totalPrice.toFixed(2)}</p>
                </div>
                <button className="checkout-button" onClick ={handleCheckout}>Checkout</button>
                </div>
        </div>
        <div className="cart-summary">
            
        </div>
        </div>
    );
}

export default ShoppingCart;