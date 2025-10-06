import React from 'react';
import { Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ListedItems = ({ userItems }) => {
  const navigate = useNavigate();

  const handleItemClick = (itemId) => {
    navigate(`/item/${itemId}`);
  };

  const isItemSold = (item) => {
    return item.availability?.status === 'sold' || item.status === 'sold' || item.availability?.quantity === 0;
  };

  const getStatusDisplay = (item) => {
    if (isItemSold(item)) {
      return 'SOLD';
    }
    return 'AVAILABLE';
  };

  const getStatusColor = (item) => {
    if (isItemSold(item)) {
      return '#ff4444'; // Red for sold
    }
    return '#44ff44'; // Green for available
  };

  const getShippingStatus = (item) => {
    if (!isItemSold(item) || !item.orderInfo) return null;
    
    const { status, shipping } = item.orderInfo;
    const statusMap = {
      'pending': 'Payment Pending',
      'confirmed': 'Order Confirmed',
      'paid': 'Paid - Ready to Ship',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'disputed': 'Disputed'
    };

    let shippingInfo = statusMap[status] || status;
    
    if (status === 'shipped' && shipping?.trackingNumber) {
      shippingInfo += ` (Tracking: ${shipping.trackingNumber})`;
    }
    
    return shippingInfo;
  };

  return (
    <div className="items-wrapper">
      <div className="items-container">
        {userItems.length > 0 ? (
          userItems.map((item) => {
            const sold = isItemSold(item);
            const statusDisplay = getStatusDisplay(item);
            const statusColor = getStatusColor(item);
            const shippingStatus = getShippingStatus(item);
            
            return (
              <div 
                key={item._id || item.id} 
                className={`itemBox ${sold ? 'sold-item' : 'available-item'}`}
                onClick={() => handleItemClick(item._id || item.id)}
                style={{ 
                  cursor: 'pointer',
                  border: `2px solid ${statusColor}`,
                  opacity: sold ? 0.8 : 1,
                  position: 'relative'
                }}
              >
                {/* Status Badge */}
                <div 
                  className="status-badge"
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: statusColor,
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    zIndex: 10
                  }}
                >
                  {statusDisplay}
                </div>

                <div className="textContainer">
                  <h1 className="itemTitle">{item.title || item.name}</h1>
                  <p className="itemPrice">Price: ${item.price}</p>
                  
                  {/* Shipping Status for Sold Items */}
                  {sold && shippingStatus && (
                    <div className="shipping-status" style={{ marginTop: '8px' }}>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#666', 
                        margin: '4px 0',
                        fontWeight: 'bold'
                      }}>
                        Status: {shippingStatus}
                      </p>
                      {item.orderInfo?.buyer && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: '#888', 
                          margin: '2px 0'
                        }}>
                          Buyer: {item.orderInfo.buyer.firstName} {item.orderInfo.buyer.lastName}
                        </p>
                      )}
                      {item.orderInfo?.orderNumber && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: '#888', 
                          margin: '2px 0'
                        }}>
                          Order: {item.orderInfo.orderNumber}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {item.images && item.images.length > 0 ? (
                  <div className="imageContainer">
                    <img 
                      src={item.images[0].url || item.images[0]} 
                      alt={item.images[0].alt || item.title || item.name} 
                      className="itemImage" 
                      style={{ 
                        filter: sold ? 'grayscale(50%)' : 'none',
                        transition: 'filter 0.3s ease'
                      }}
                      onError={(e) => {
                        console.error('Image failed to load:', item.images[0].url || item.images[0]);
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <p>No image available</p>
                )}
              </div>
            );
          })
        ) : (
          <Typography>No items listed yet.</Typography>
        )}
      </div>
    </div>
  );
};

export default ListedItems;
