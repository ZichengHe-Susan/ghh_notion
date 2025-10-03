import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/ShoppingCart.css';
import defaultImage from '../assets/coming-soon.jpg';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import apiService from '../services/api';
import AddressModal from '../components/AddressModal';
import StripePaymentForm from '../components/StripePaymentForm';
import PaymentMethodManager from '../components/PaymentMethodManager';

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
    
    // Stripe payment state
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [showPaymentMethods, setShowPaymentMethods] = useState(false);
    const [pricingBreakdown, setPricingBreakdown] = useState(null);
    const [calculatingFees, setCalculatingFees] = useState(false);

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
            
            // Show payment options
            setShowPaymentMethods(true);
        } catch (error) {
            console.error('CHECKOUT ERROR:', error);
            alert('Checkout failed. Please try again.');
        }
    };

    const handlePaymentSuccess = async (paymentResult) => {
        try {
            // Clear the cart after successful payment
            await clearCart();
            
            // Navigate to confirmation page with payment result
            navigate('/checkedOut', {
                state: {
                paymentResult,
                orderData: paymentResult.orderData,
                orderNumber: paymentResult.orderData.orderNumber,
                items: cartItems,
                totalPrice: totalPrice,
                timestamp: new Date(),
                status: 'confirmed'
            }
        });
        } catch (error) {
            console.error(' ERROR AFTER SUCCESSFUL PAYMENT:', error);
        }
    };

    const handlePaymentError = (error) => {
        console.error('PAYMENT ERROR HANDLER CALLED:', {
            error: error,
            timestamp: new Date().toISOString()
        });
        alert(`Payment failed: ${error.message || 'Please try again.'}`);
        setPaymentProcessing(false);
    };

    const calculateOrderFees = async () => {
        try {
            setCalculatingFees(true);
            
            if (!orderData) {
                throw new Error('Order data is not available');
            }

            const response = await apiService.calculateOrderFees(orderData);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to calculate order fees');
            }

            setPricingBreakdown(response.data.pricing);
            return response.data.pricing;
        } catch (error) {
            console.error('Error calculating order fees:', error);
            alert(`Failed to calculate order fees: ${error.message}`);
            return null;
        } finally {
            setCalculatingFees(false);
        }
    };

    const handleProceedToPayment = async () => {
        try {
            // Calculate fees first
            const fees = await calculateOrderFees();
            
            if (!fees) {
                return; // Error already handled in calculateOrderFees
            }

            setShowPaymentMethods(false);
            setShowPaymentForm(true);
            setPaymentProcessing(false); // Don't set to true here - let StripePaymentForm handle its own loading state
        } catch (error) {
            console.error('Error proceeding to payment:', error);
            alert('Failed to proceed to payment. Please try again.');
        }
    };

    const handlePaymentMethodSelect = (paymentMethod) => {
        setSelectedPaymentMethod(paymentMethod);
    };

    const orderData = useMemo(() => {

        if (!selectedAddress) {
            return null;
        }

        const transformedItems = cartItems.map(item => ({
            itemId: item._id || item.id,
            quantity: item.quantity
        }));
        
        const data = {
            items: transformedItems,
            shippingAddressId: selectedAddress._id,
            shippingMethod: 'standard',
            paymentMethod: 'stripe',
            notes: ''
        };

        return data;
    }, [cartItems, selectedAddress]);
    
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
                <button className="checkout-button" onClick={handleCheckout}>Proceed to Payment</button>
                </div>
                
                {/* Payment Methods Section */}
                {showPaymentMethods && (
                    <div className="payment-methods-section">
                        <PaymentMethodManager 
                            onPaymentMethodSelect={handlePaymentMethodSelect}
                            onPaymentMethodAdded={() => setShowPaymentForm(true)}
                        />
                        
                        <div className="payment-actions">
                            <button 
                                onClick={handleProceedToPayment}
                                className="proceed-payment-btn"
                                disabled={calculatingFees}
                            >
                                {calculatingFees ? 'Calculating Fees...' : 'Continue with New Payment Method'}
                            </button>
                            
                            <button 
                                onClick={() => setShowPaymentMethods(false)}
                                className="cancel-payment-btn"
                                disabled={calculatingFees}
                            >
                                Back to Cart
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Stripe Payment Form */}
                {showPaymentForm && orderData && (
                    <div className="stripe-payment-section">
                        <StripePaymentForm
                            orderData={orderData}
                            totalAmount={totalPrice}
                            pricingBreakdown={pricingBreakdown}
                            onSuccess={handlePaymentSuccess}
                            onError={handlePaymentError}
                            billingDetails={{
                                name: currentUser?.name || '',
                                email: currentUser?.email || ''
                            }}
                            isLoading={paymentProcessing}
                        />
                        
                        <button 
                            onClick={() => {
                                setShowPaymentForm(false);
                                setShowPaymentMethods(true);
                            }}
                            className="back-to-methods-btn"
                        >
                            ← Back to Payment Methods
                        </button>
                    </div>
                )}
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