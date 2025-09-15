import React, { useState, useEffect } from 'react';
import { Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import '../css/profile.scss'; 

const OrderHistory = () => {
    const { currentUser } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentUser) {
            const fetchOrders = async () => {
                try {
                    setLoading(true);
                    const result = await apiService.getOrders();
                    if (result.success) {
                        // Filter orders for current user
                        const userOrders = result.data.filter(order => order.buyer === currentUser.id);
                        setOrders(userOrders);
                    } else {
                        console.error('Error fetching orders:', result.error);
                    }
                } catch (err) {
                    console.error('Error fetching user orders:', err);
                } finally {
                    setLoading(false);
                }
            };

            fetchOrders();
        }
    }, [currentUser]);

    if (loading) {
        return <Typography variant="body1">Loading orders...</Typography>;
    }

    return (
        <div className="order-history">
            {orders.length > 0 ? (
                orders.map((order) => (
                    <div key={order._id} className="order">
                        <Typography variant="h6" gutterBottom className="order-id">
                            Order ID: {order.orderNumber || order._id}
                        </Typography>
                        <Typography variant="body1" gutterBottom className="order-total">
                            Total: ${order.totalPrice}
                        </Typography>
                        <Typography variant="body1" gutterBottom className="order-status">
                            Status: {order.status}
                        </Typography>
                    </div>
                ))
            ) : (
                <Typography variant="body1" gutterBottom>
                    You have not placed any orders yet.
                </Typography>
            )}
        </div>
    );
};

export default OrderHistory;
