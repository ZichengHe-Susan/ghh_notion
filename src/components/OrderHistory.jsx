import React, { useState, useEffect } from 'react';
import { Typography, Card, CardContent, Box, Chip, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import '../css/profile.scss'; 

const OrderHistory = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentUser) {
            const fetchOrders = async () => {
                try {
                    setLoading(true);
                    const result = await apiService.getUserOrders(currentUser.id);
                    if (result.success) {
                        setOrders(result.data);
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

    const getStatusColor = (status) => {
        const statusColors = {
            pending: 'warning',
            confirmed: 'info',
            paid: 'primary',
            shipped: 'secondary',
            delivered: 'success',
            completed: 'success',
            cancelled: 'error',
            disputed: 'error'
        };
        return statusColors[status] || 'default';
    };

    const handleOrderClick = (orderId) => {
        navigate(`/order/${orderId}`);
    };

    if (loading) {
        return <Typography variant="body1">Loading orders...</Typography>;
    }

    return (
        <div className="order-history">
            {orders.length > 0 ? (
                orders.map((order) => (
                    <Card 
                        key={order._id} 
                        className="order-card"
                        sx={{ 
                            mb: 2, 
                            cursor: 'pointer',
                            '&:hover': {
                                boxShadow: 3
                            }
                        }}
                        onClick={() => handleOrderClick(order._id)}
                    >
                        <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="h6" className="order-id">
                                    Order #{order.orderNumber || order._id.slice(-8)}
                                </Typography>
                                <Chip 
                                    label={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    color={getStatusColor(order.status)}
                                    size="small"
                                />
                            </Box>
                            
                            <Typography variant="body1" gutterBottom className="order-total">
                                Total: ${order.pricing?.total?.toFixed(2) || '0.00'}
                            </Typography>
                            
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Placed on {new Date(order.createdAt).toLocaleDateString()}
                            </Typography>

                            {order.items && order.items.length > 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    {order.items.length} item{order.items.length > 1 ? 's' : ''}
                                </Typography>
                            )}

                            <Box mt={1}>
                                <Button 
                                    variant="outlined" 
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOrderClick(order._id);
                                    }}
                                >
                                    View Details
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
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
