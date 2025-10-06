import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import '../css/ItemDetail.scss';

const ItemDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Get the item ID from the URL
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleGoBack = () => {
    navigate('/');
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

  return (
    <div className="item-details-wrapper">
    <div className="item-details-container">
      <button className='back-button-checkout' onClick={handleGoBack}>Go back to homepage</button>

      <h1>{itemData.title || itemData.name}</h1>
      <p><strong>Price:</strong> ${itemData.price}</p>
      <p><strong>Description:</strong> {itemData.description}</p>
      <p><strong>Location Details:</strong> {itemData.location ? `${itemData.location.address}, ${itemData.location.city}, ${itemData.location.state} ${itemData.location.zipCode}` : 'Location not specified'}</p>
      
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

      <button className="add-to-cart-button">Add to Cart</button>

      {itemData.images && itemData.images.length > 0 ? (
        <div className="item-images">
          {itemData.images.map((image, index) => (
            <img 
              key={index}
              src={image.url || image} 
              alt={image.alt || itemData.title || itemData.name} 
              className="item-image" 
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
