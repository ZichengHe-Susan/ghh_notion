import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Checkout = () => {
    const navigate = useNavigate();
    const { state } = useLocation();  
    const { orderNumber, items, totalPrice, timestamp, status, orderData } = state || {};

    const handleGoBack = () => {
        navigate('/');
    };

    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h1>Thank you for your payment!</h1>
            <p>Order Number: {orderNumber}</p>
            {orderData && <p>Delivery Method: {orderData.shippingMethod}</p>}
            <p>Total Price: ${totalPrice.toFixed(2)}</p>
            <p>Status: {status}</p>
            <p>Order Time: {new Date(timestamp).toLocaleString()}</p>
            <button className='back-button' onClick={handleGoBack}>Go back to homepage</button>
        </div>
    );
};

export default Checkout;
