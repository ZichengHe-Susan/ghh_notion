import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import '../css/ViewItems.css';

const ViewItems = () => {
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const getItemsList = async () => {
      try {
        setLoading(true);
        const result = await apiService.getItems();
        if (result.success) {
          // Filter available items
          const filteredData = result.data.items.filter(item => item.isAvailable);
          setItemsList(filteredData);
        } else {
          console.error("Error fetching items: ", result.error);
        }
      } catch (err) {
        console.error("Error fetching items: ", err);
      } finally {
        setLoading(false);
      }
    };
  
    getItemsList();
  }, []);  

  const addToCart = async (item) => {
    try {
      // For now, we'll just show an alert since cart functionality might not be fully implemented
      // You can implement proper cart functionality later
      alert(`${item.name} has been added to your cart!`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart');
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const result = await apiService.deleteItem(itemId);
      if (result.success) {
        setItemsList(itemsList.filter(item => item._id !== itemId));
        alert("Item deleted successfully.");
      } else {
        alert(`Failed to delete item: ${result.error}`);
      }
    } catch (err) {
      console.error("Error deleting item: ", err);
      alert("Failed to delete item. Please try again.");
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
        {itemsList.map((item) => (
          <div key={item._id} className="itemBox">
            <div className="textContainer">
              <Link to={`/item/${item._id}`} className="itemTitle">
                <h1 className="itemNameShop">{item.name}</h1>
              </Link> 
              <p className="itemPrice">Price: ${item.price}</p>
              <div className="button-group">
              {currentUser && currentUser.id !== item.seller && 
                (<button
                  className="addToCartButton" 
                  onClick={() => addToCart(item)} 
                  >Add to Cart</button>)}
                  {currentUser && currentUser.id === item.seller && ( 
                  <button className="deleteButton" onClick={() => deleteItem(item._id)}>
                    Delete Item
                </button>
                )}
              </div>
            </div>
            {item.images && item.images.length > 0 ? (
              <div className="imageContainer">
                <img src={item.images[0]} alt={item.name} className="itemImage" />
              </div>
            ) : (
              <p>No image available</p>
            )}          
          </div>
        ))}
      </div>
    </div>
    
  );
};

export default ViewItems;