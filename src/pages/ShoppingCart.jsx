import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/ShoppingCart.css';
import defaultImage from '../assets/coming-soon.jpg';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import apiService from '../services/api';
import AddressModal from '../components/AddressModal';

const ShoppingCart = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { cartItems, removeFromCart, clearCart, updateItemQuantity } = useCart();
    const [totalPrice, setTotalPrice] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Shipping address state - now only for selected address
    const [shippingAddress, setShippingAddress] = useState(null);
    
    // Address modal state
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (!currentUser) {
          navigate('/login');
        }
      }, [currentUser, navigate]);
    
    useEffect(() => {
        if (currentUser && cartItems) {
            // Calculate total price considering quantity
            const totalP = cartItems.reduce((acc, item) => {
                const itemPrice = item.price || 0;
                const quantity = item.quantity || 1;
                return acc + (itemPrice * quantity);
            }, 0);
            setTotalPrice(totalP);
            setLoading(false);
        }
    }, [currentUser, cartItems]);

    const handleAddressSelect = (address) => {
        setSelectedAddress(address);
        setShippingAddress(address.address);
    }; 

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
            
            // Validate shipping address - must select from address book
            if (!selectedAddress) {
                alert('Please select an address from your address book.');
                return;
            }
            
            // Transform cart items to match backend expectations
            const transformedItems = cartItems.map(item => ({
                itemId: item._id || item.id,
                quantity: item.quantity
            }));

            const orderData = {
                items: transformedItems,
                shippingAddress: selectedAddress.address,
                shippingMethod: 'standard',
                paymentMethod: 'stripe',
                notes: ''
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
                                <img src={(item.images && item.images[0]?.url) || (item.images && item.images[0]) || item.imageURL || defaultImage} alt={item.title || item.name} className='item-image' />
                                <span className="item-title">{item.title || item.name}</span>
                                <span className="item-price">${item.price}</span>
                                <div className="quantity-controls">
                                    <button 
                                        className="quantity-btn" 
                                        onClick={() => updateItemQuantity(item._id || item.id, (item.quantity || 1) - 1)}
                                        disabled={!item.quantity || item.quantity <= 1}
                                    >-</button>
                                    <span className="item-quantity">{item.quantity || 1}</span>
                                    <button 
                                        className="quantity-btn" 
                                        onClick={() => updateItemQuantity(item._id || item.id, (item.quantity || 1) + 1)}
                                    >+</button>
                                </div>
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
            <div className="shipping-form">
                <h2>Shipping Address</h2>
                
                {/* Address Selection */}
                <div className="address-selection">
                    <button 
                        type="button" 
                        className="select-address-btn"
                        onClick={() => setShowAddressModal(true)}
                    >
                        {selectedAddress ? `Selected: ${selectedAddress.label}` : 'Select from Address Book'}
                    </button>
                    {selectedAddress && (
                        <button 
                            type="button" 
                            className="clear-address-btn"
                            onClick={() => {
                                setSelectedAddress(null);
                                setShippingAddress(null);
                            }}
                        >
                            Clear Selection
                        </button>
                    )}
                </div>

            </div>
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

        {/* Address Modal */}
        <AddressModal
            isOpen={showAddressModal}
            onClose={() => setShowAddressModal(false)}
            onSelectAddress={handleAddressSelect}
            selectedAddressId={selectedAddress?._id}
            title="Select Shipping Address"
            allowSave={true}
        />
        </div>
    );
}

export default ShoppingCart;