import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import '../css/ItemDetail.scss';

const ItemDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Get the item ID from the URL
  const { currentUser } = useAuth();
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');

  const handleGoBack = () => {
    navigate('/');
  };

  const isItemSold = (item) => {
    return item.availability?.status === 'sold' || item.status === 'sold' || item.availability?.quantity === 0;
  };

  const isCurrentUserSeller = (item) => {
    return currentUser && item.seller && (item.seller._id === currentUser.id || item.seller.id === currentUser.id);
  };

  const formatAddress = (addressObj) => {
    if (!addressObj?.address?.address) return 'Location not specified';
    
    const addr = addressObj.address.address;
    const parts = [];
    
    if (addr.street) parts.push(addr.street);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    if (addr.zipCode) parts.push(addr.zipCode);
    
    return parts.join(', ');
  };

  const handleUpdateDeliveryStatus = async (newStatus, additionalData = {}) => {
    if (!itemData?.orderInfo?.orderId) return;
    
    try {
      setUpdatingStatus(true);
      const result = await apiService.updateOrderStatus(itemData.orderInfo.orderId, newStatus, additionalData);
      
      if (result.success) {
        // Refresh item data to get updated order info
        const refreshResult = await apiService.getItem(id);
        if (refreshResult.success) {
          setItemData(refreshResult.data);
        }
        // Reset form state
        setShowShippingForm(false);
        setTrackingNumber('');
        setCarrier('');
      } else {
        alert('Failed to update delivery status: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      alert('Failed to update delivery status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleMarkAsShipped = () => {
    if (!trackingNumber.trim() || !carrier.trim()) {
      alert('Please enter both tracking number and carrier');
      return;
    }
    
    handleUpdateDeliveryStatus('shipped', {
      trackingNumber: trackingNumber.trim(),
      carrier: carrier.trim()
    });
  };

  const handleShowShippingForm = () => {
    setShowShippingForm(true);
  };

  const handleCancelShippingForm = () => {
    setShowShippingForm(false);
    setTrackingNumber('');
    setCarrier('');
  };

  useEffect(() => {
    const fetchItemDetails = async () => {
      try {
        setLoading(true);
        const result = await apiService.getItem(id);
        if (result.success) {
          console.log("Item data received:", result.data);
          console.log("Images:", result.data.images);
          setItemData(result.data);
        } else {
          console.log("Item not found:", result.error);
        }
      } catch (error) {
        console.error("Error fetching item details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchItemDetails();
    }
  }, [id]); // Run effect when the ID changes

  if (loading) {
    return <p>Loading item details...</p>;
  }

  if (!itemData) {
    return <p>Item not found.</p>;
  }

  const sold = isItemSold(itemData);
  const isSeller = isCurrentUserSeller(itemData);

  return (
    <div className="item-details-wrapper">
      <div className="item-details-container">
        <button className='back-button-checkout' onClick={handleGoBack}>Go back to homepage</button>

        {/* Status Badge */}
        {sold && (
          <div className="status-badge sold" style={{
            display: 'inline-block',
            backgroundColor: '#ff4444',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}>
            SOLD
          </div>
        )}

        <h1>{itemData.title || itemData.name}</h1>
        <p><strong>Price:</strong> ${itemData.price}</p>
        <p><strong>Description:</strong> {itemData.description}</p>
        <p><strong>Location Details:</strong> {formatAddress(itemData.location)}</p>
        
        {itemData.shipping && itemData.shipping.shippingMethods && itemData.shipping.shippingMethods.length > 0 && (
          <div className="shipping-methods">
            <strong>Available Delivery Methods:</strong>
            <ul>
              {itemData.shipping.shippingMethods.map((method, index) => (
                <li key={index}>{method.charAt(0).toUpperCase() + method.slice(1)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Seller-specific information for sold items */}
        {isSeller && sold && itemData.orderInfo && (
          <div className="seller-order-info" style={{
            backgroundColor: '#f5f5f5',
            padding: '20px',
            borderRadius: '8px',
            margin: '20px 0',
            border: '1px solid #ddd'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Order Information</h3>
            
            {/* Order Status */}
            <div style={{ marginBottom: '15px' }}>
              <strong>Order Status:</strong> 
              <span style={{ 
                marginLeft: '10px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: itemData.orderInfo.status === 'delivered' ? '#4caf50' : '#ff9800',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {itemData.orderInfo.status.toUpperCase()}
              </span>
            </div>

            {/* Order Number */}
            <p><strong>Order Number:</strong> {itemData.orderInfo.orderNumber}</p>

            {/* Buyer Information */}
            {itemData.orderInfo.buyer && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Buyer:</strong> {itemData.orderInfo.buyer.firstName} {itemData.orderInfo.buyer.lastName}
                <br />
                <strong>Email:</strong> {itemData.orderInfo.buyer.email}
                {itemData.orderInfo.buyer.phone && (
                  <>
                    <br />
                    <strong>Phone:</strong> {itemData.orderInfo.buyer.phone}
                  </>
                )}
              </div>
            )}

            {/* Shipping Address */}
            {itemData.orderInfo.shipping?.address && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Shipping Address:</strong>
                <div style={{ marginLeft: '10px', marginTop: '5px' }}>
                  {formatAddress(itemData.orderInfo.shipping.address)}
                </div>
              </div>
            )}

            {/* Payment Status */}
            {itemData.orderInfo.payment && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Payment Status:</strong> 
                <span style={{ 
                  marginLeft: '10px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: itemData.orderInfo.payment.status === 'succeeded' ? '#4caf50' : '#f44336',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {itemData.orderInfo.payment.status.toUpperCase()}
                </span>
                {itemData.orderInfo.payment.paidAt && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Paid on: {new Date(itemData.orderInfo.payment.paidAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {/* Buyer Confirmation Status */}
            {itemData.orderInfo.escrow && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Buyer Confirmation:</strong>
                <span style={{ 
                  marginLeft: '10px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: itemData.orderInfo.escrow.status === 'released' ? '#4caf50' : '#ff9800',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {itemData.orderInfo.escrow.status === 'released' ? 'CONFIRMED' : 'PENDING'}
                </span>
                {itemData.orderInfo.escrow.releasedAt && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Confirmed on: {new Date(itemData.orderInfo.escrow.releasedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {/* Mark as Shipped button - only for sellers */}
            {itemData.orderInfo.status === 'paid' && !showShippingForm && isSeller && (
              <div style={{ marginTop: '20px' }}>
                <button 
                  onClick={handleShowShippingForm}
                  disabled={updatingStatus}
                  style={{
                    backgroundColor: '#2196f3',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    cursor: updatingStatus ? 'not-allowed' : 'pointer',
                    marginRight: '10px',
                    opacity: updatingStatus ? 0.6 : 1
                  }}
                >
                  Mark as Shipped
                </button>
              </div>
            )}

            {/* Shipping Form - only for sellers */}
            {itemData.orderInfo.status === 'paid' && showShippingForm && isSeller && (
              <div className="shipping-form">
                <h4>Shipping Information</h4>
                
                <div className="form-group">
                  <label>Tracking Number *</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                  />
                </div>

                <div className="form-group">
                  <label>Carrier *</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="Enter carrier name (e.g., UPS, FedEx, USPS)"
                  />
                </div>

                <div className="form-actions">
                  <button 
                    className="confirm-btn"
                    onClick={handleMarkAsShipped}
                    disabled={updatingStatus || !trackingNumber.trim() || !carrier.trim()}
                  >
                    {updatingStatus ? 'Updating...' : 'Confirm Shipment'}
                  </button>
                  
                  <button 
                    className="cancel-btn"
                    onClick={handleCancelShippingForm}
                    disabled={updatingStatus}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Mark as Delivered button - only for buyers, not sellers */}
            {itemData.orderInfo.status === 'shipped' && !isSeller && (
              <div style={{ marginTop: '20px' }}>
                <button 
                  onClick={() => handleUpdateDeliveryStatus('delivered')}
                  disabled={updatingStatus}
                  style={{
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    cursor: updatingStatus ? 'not-allowed' : 'pointer',
                    opacity: updatingStatus ? 0.6 : 1
                  }}
                >
                  {updatingStatus ? 'Updating...' : 'Mark as Delivered'}
                </button>
              </div>
            )}

            {/* Tracking Information */}
            {itemData.orderInfo.shipping?.trackingNumber && (
              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                <strong>Tracking Number:</strong> {itemData.orderInfo.shipping.trackingNumber}
                {itemData.orderInfo.shipping.carrier && (
                  <div><strong>Carrier:</strong> {itemData.orderInfo.shipping.carrier}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add to Cart button - only show if not seller and item is available */}
        {!isSeller && !sold && (
          <button className="add-to-cart-button">Add to Cart</button>
        )}

        {/* Show message if seller viewing their own item */}
        {isSeller && !sold && (
          <div style={{
            backgroundColor: '#e8f5e8',
            padding: '15px',
            borderRadius: '8px',
            margin: '20px 0',
            border: '1px solid #4caf50'
          }}>
            <strong>This is your listed item.</strong> You can manage it from your profile page.
          </div>
        )}

        {itemData.images && itemData.images.length > 0 ? (
          <div className="item-images">
            {itemData.images.map((image, index) => (
              <img 
                key={index}
                src={image.url || image} 
                alt={image.alt || itemData.title || itemData.name} 
                className="item-image" 
                style={{ 
                  filter: sold ? 'grayscale(30%)' : 'none',
                  transition: 'filter 0.3s ease'
                }}
                onError={(e) => {
                  console.error('Image failed to load:', image.url || image);
                  e.target.style.display = 'none';
                }}
              />
            ))}
          </div>
        ) : (
          <p>No image available</p>
        )}
      </div>
    </div>
  );
};

export default ItemDetails;
