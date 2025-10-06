import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Box, 
  Chip, 
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import { 
  ArrowBack, 
  LocalShipping, 
  Payment, 
  CheckCircle, 
  Cancel,
  Warning
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import '../css/OrderDetails.css';

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deliveredDialogOpen, setDeliveredDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (orderId && currentUser) {
      fetchOrderDetails();
    }
  }, [orderId, currentUser]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getOrder(orderId);
      
      if (result.success) {
        setOrder(result.data);
      } else {
        setError('Failed to load order details');
        console.error('Error fetching order:', result.error);
      }
    } catch (err) {
      setError('Failed to load order details');
      console.error('Error fetching order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async () => {
    try {
      setActionLoading(true);
      const result = await apiService.confirmOrder(orderId);
      
      if (result.success) {
        setOrder(prev => ({ ...prev, status: 'completed', escrow: { ...prev.escrow, status: 'released' } }));
        setConfirmDialogOpen(false);
        setSuccessMessage('Order confirmed successfully! Payment has been released to the seller.');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError('Failed to confirm order');
        console.error('Error confirming order:', result.error);
      }
    } catch (err) {
      setError('Failed to confirm order');
      console.error('Error confirming order:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsDelivered = async () => {
    try {
      setActionLoading(true);
      const result = await apiService.updateOrderStatus(orderId, 'delivered');
      
      if (result.success) {
        setOrder(prev => ({ ...prev, status: 'delivered' }));
        setDeliveredDialogOpen(false);
        setSuccessMessage('Order marked as delivered successfully! You can now confirm your purchase.');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError('Failed to mark order as delivered');
        console.error('Error marking order as delivered:', result.error);
      }
    } catch (err) {
      setError('Failed to mark order as delivered');
      console.error('Error marking order as delivered:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    try {
      setActionLoading(true);
      const result = await apiService.cancelOrder(orderId, cancelReason);
      
      if (result.success) {
        setOrder(prev => ({ ...prev, status: 'cancelled' }));
        setCancelDialogOpen(false);
        setCancelReason('');
        setSuccessMessage('Order cancelled successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError('Failed to cancel order');
        console.error('Error cancelling order:', result.error);
      }
    } catch (err) {
      setError('Failed to cancel order');
      console.error('Error cancelling order:', err);
    } finally {
      setActionLoading(false);
    }
  };

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

  const getStatusIcon = (status) => {
    const statusIcons = {
      pending: <Payment />,
      confirmed: <CheckCircle />,
      paid: <Payment />,
      shipped: <LocalShipping />,
      delivered: <CheckCircle />,
      completed: <CheckCircle />,
      cancelled: <Cancel />,
      disputed: <Warning />
    };
    return statusIcons[status] || <Payment />;
  };

  const canConfirmOrder = () => {
    if (!order || !currentUser || order.buyer._id !== currentUser.id) return false;
    const isShipped = ['standard', 'express', 'overnight'].includes(order.shipping.method);
    if (isShipped) {
      return order.status === 'delivered' && order.escrow?.status === 'held';
    }
    return order.status === 'paid' && order.escrow?.status === 'held';
  };

  const isShippedOrder = () => {
    return order && ['standard', 'express', 'overnight'].includes(order.shipping.method);
  }

  const canMarkAsDelivered = () => {
    if (!order || !currentUser || order.buyer._id !== currentUser.id) return false;
    return order.status === 'shipped' && order.buyer._id === currentUser.id;
  };

  const canCancelOrder = () => {
    return order && ['pending', 'confirmed', 'paid', 'shipped'].includes(order.status);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !order) {
    return (
      <Box p={3}>
        <Alert severity="error">
          {error || 'Order not found'}
        </Alert>
        <Button 
          startIcon={<ArrowBack />} 
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <div className="order-details-container">
      <Box p={3}>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={3}>
          <Button 
            startIcon={<ArrowBack />} 
            onClick={() => navigate(-1)}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            Order Details
          </Typography>
        </Box>

        {/* Success Message */}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Order Status */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">
                Order #{order.orderNumber}
              </Typography>
              <Chip 
                icon={getStatusIcon(order.status)}
                label={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                color={getStatusColor(order.status)}
                variant="outlined"
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary">
              Placed on {new Date(order.createdAt).toLocaleDateString()}
            </Typography>

            {/* Escrow Status */}
            {order.escrow && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Payment Status: 
                  <Chip 
                    label={order.escrow.status.charAt(0).toUpperCase() + order.escrow.status.slice(1)}
                    size="small"
                    sx={{ ml: 1 }}
                    color={order.escrow.status === 'held' ? 'warning' : 'success'}
                  />
                </Typography>
                {order.escrow.status === 'held' && (
                  <Typography variant="caption" color="text.secondary">
                    Payment is held in escrow until you confirm receipt
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Items Ordered
            </Typography>
            {order.items && order.items.map((item, index) => (
              <Box key={index} mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1">
                      {item.itemSnapshot?.title || 'Item'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Quantity: {item.quantity}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Condition: {item.itemSnapshot?.condition || 'N/A'}
                    </Typography>
                  </Box>
                  <Typography variant="h6">
                    ${item.price?.toFixed(2)}
                  </Typography>
                </Box>
                {index < order.items.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* Pricing Breakdown */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography>Subtotal:</Typography>
              <Typography>${order.pricing?.subtotal?.toFixed(2)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography>Shipping:</Typography>
              <Typography>${order.pricing?.shippingCost?.toFixed(2)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography>Tax:</Typography>
              <Typography>${order.pricing?.tax?.toFixed(2)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography>Platform Fee:</Typography>
              <Typography>${order.pricing?.platformFee?.toFixed(2)}</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" justifyContent="space-between">
              <Typography variant="h6">Total:</Typography>
              <Typography variant="h6">${order.pricing?.total?.toFixed(2)}</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Shipping Information */}
        {order.shipping && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Shipping Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Method: {order.shipping.method.charAt(0).toUpperCase() + order.shipping.method.slice(1)}
              </Typography>
              {order.shipping.address && (
                <Typography variant="body2" color="text.secondary">
                  Address: {`${order.shipping.address.address.street}, ${order.shipping.address.address.city}, ${order.shipping.address.address.state} ${order.shipping.address.address.zipCode}`}
                </Typography>
              )}
              {order.shipping.trackingNumber && (
                <Typography variant="body2" color="text.secondary">
                  Tracking: {order.shipping.trackingNumber}
                </Typography>
              )}
              {order.shipping.carrier && (
                <Typography variant="body2" color="text.secondary">
                  Carrier: {order.shipping.carrier}
                </Typography>
              )}
              {order.shipping.estimatedDelivery && (
                <Typography variant="body2" color="text.secondary">
                  Estimated Delivery: {new Date(order.shipping.estimatedDelivery).toLocaleDateString()}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {order.buyer._id === currentUser.id && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Actions
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                {canMarkAsDelivered() && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<LocalShipping />}
                    onClick={() => setDeliveredDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Mark as Delivered
                  </Button>
                )}

                {canConfirmOrder() && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => setConfirmDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Confirm Purchase
                  </Button>
                )}
                
                {canCancelOrder() && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Cancel Order
                  </Button>
                )}

                {order.status === 'shipped' && (
                  <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
                    Your order has been shipped. Please mark it as delivered when you receive it.
                  </Alert>
                )}

                {order.status === 'delivered' && order.escrow?.status === 'held' && (
                  <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
                    Your order has been delivered. Please confirm receipt to release payment to the seller.
                  </Alert>
                )}

                {order.status === 'completed' && (
                  <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
                    Order completed! Payment has been released to the seller. Thank you for your purchase!
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Mark as Delivered Dialog */}
        <Dialog open={deliveredDialogOpen} onClose={() => setDeliveredDialogOpen(false)}>
          <DialogTitle>
            <Box display="flex" alignItems="center">
              <LocalShipping color="primary" sx={{ mr: 1 }} />
              Mark as Delivered
            </Box>
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please confirm that you have received your order and everything is as expected. 
              Once marked as delivered, you will be able to confirm your purchase to release 
              payment to the seller.
            </DialogContentText>
            <DialogContentText sx={{ mt: 2 }}>
              Have you received your order?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeliveredDialogOpen(false)} disabled={actionLoading}>
              Not Yet
            </Button>
            <Button 
              onClick={handleMarkAsDelivered} 
              color="primary" 
              variant="contained"
              disabled={actionLoading}
            >
              {actionLoading ? <CircularProgress size={20} /> : 'Yes, Mark as Delivered'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
          <DialogTitle>
            <Box display="flex" alignItems="center">
              <Warning color="warning" sx={{ mr: 1 }} />
              Confirm Purchase
            </Box>
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              <strong>Warning:</strong> By confirming this purchase, you are stating that you have received 
              the item(s) and everything is satisfactory. Once confirmed, the payment will be released 
              to the seller and <strong>cannot be reversed</strong>.
            </DialogContentText>
            <DialogContentText sx={{ mt: 2 }}>
              Are you sure you want to confirm this purchase?
            </DialogContentText>
            {!isShippedOrder() && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This is a '{order.shipping.method}' order. Confirming will immediately release payment to the seller. This action cannot be undone.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmOrder} 
              color="success" 
              variant="contained"
              disabled={actionLoading}
            >
              {actionLoading ? <CircularProgress size={20} /> : 'Confirm Purchase'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Cancellation Dialog */}
        <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to cancel this order? This action may not be reversible 
              depending on the order status.
            </DialogContentText>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Reason for cancellation (optional):
              </Typography>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancelling this order..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)} disabled={actionLoading}>
              Keep Order
            </Button>
            <Button 
              onClick={handleCancelOrder} 
              color="error" 
              variant="contained"
              disabled={actionLoading}
            >
              {actionLoading ? <CircularProgress size={20} /> : 'Cancel Order'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </div>
  );
};

export default OrderDetails;
