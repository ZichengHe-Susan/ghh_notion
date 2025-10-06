import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import apiService from '../services/api';
import '../css/ViewItems.css';

const ViewItems = () => {
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, isEmailVerified } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    const getItemsList = async () => {
      try {
        setLoading(true);
        console.log('Fetching items...');
        const result = await apiService.getItems();
        console.log('Items API response:', result);
        
        if (result.success && result.data) {
          // Handle nested data structure - check if data.data exists
          const actualData = result.data.data || result.data;
          
          if (actualData && actualData.items && Array.isArray(actualData.items)) {
            // Filter available items - check for proper availability structure
            const filteredData = actualData.items.filter(item => 
              item.status === 'active' && 
              item.availability && 
              item.availability.status === 'available' && 
              item.availability.quantity > 0
            );
            console.log('Filtered items:', filteredData.length);
            setItemsList(filteredData);
          } else {
            console.error("Invalid items structure in response:", actualData);
            setItemsList([]);
          }
        } else {
          // Handle different error scenarios
          if (result.success === false) {
            console.error("API Error fetching items:", result.error || 'Unknown error');
          } else {
            console.error("Invalid response structure:", result);
          }
          setItemsList([]);
        }
      } catch (err) {
        console.error("Network/Request Error fetching items:", err);
        setItemsList([]);
      } finally {
        setLoading(false);
      }
    };
  
    getItemsList();
  }, []);  

  const handleAddToCart = async (item) => {
    try {
      await addToCart(item);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };


  if (loading) {
    return (
      <div className="container">
        <h2 className="shopHeader">Loading items...</h2>
      </div>
    );
  }

  return (
    <div>
      <div className="container">
        <h2 className="shopHeader">Click on the items to view item details </h2>
        
      </div>
        
      <div className="container">
        {itemsList.length === 0 ? (
          <div className="no-items-message">
            <h3>No items available at the moment</h3>
            <p>Check back later or add some items to the marketplace!</p>
          </div>
        ) : (
          itemsList.map((item) => (
          <div key={item._id} className="itemBox">
            <div className="textContainer">
              <Link to={`/item/${item._id}`} className="itemTitle">
                <h1 className="itemNameShop">{item.title}</h1>
              </Link> 
              <p className="itemPrice">Price: ${item.price}</p>
              <div className="button-group">
              {currentUser && isEmailVerified && currentUser.id !== item.seller._id && 
                (<button
                  className="addToCartButton" 
                  onClick={() => handleAddToCart(item)} 
                  >Add to Cart</button>)}
                  {currentUser && isEmailVerified && currentUser.id === item.seller._id && ( 
                  <span className="own-listing-tag">
                    Your own listing
                  </span>
                )}
              </div>
            </div>
            {item.images && item.images.length > 0 ? (
              <div className="imageContainer">
                <img src={item.images[0].url || item.images[0]} alt={item.title} className="itemImage" />
              </div>
            ) : (
              <p>No image available</p>
            )}          
          </div>
        ))
        )}
      </div>
    </div>
    
  );
};

export default ViewItems;