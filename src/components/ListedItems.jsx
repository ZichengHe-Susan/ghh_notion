import React from 'react';
import { Typography } from '@mui/material';

const ListedItems = ({ userItems }) => {
  return (
    <div className="items-wrapper">
    <div className="items-container">
      {userItems.length > 0 ? (
        userItems.map((item) => (
          <div key={item._id || item.id} className="itemBox">
            <div className="textContainer">
              <h1 className="itemTitle">{item.title || item.name}</h1>
              <p className="itemPrice">Price: ${item.price}</p>
            </div>
            {item.images && item.images.length > 0 ? (
              <div className="imageContainer">
                <img 
                  src={item.images[0].url || item.images[0]} 
                  alt={item.images[0].alt || item.title || item.name} 
                  className="itemImage" 
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
          
        ))
      ) : (
        <Typography>No items listed yet.</Typography>
      )}
    </div>
    </div>
  );
};

export default ListedItems;
