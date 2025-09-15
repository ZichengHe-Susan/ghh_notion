import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import '../css/Upload.scss';

const AddItem = () => {
  const { currentUser, userData } = useAuth();
  const [newItemName, setItemName] = useState("");
  const [newItemPrice, setItemPrice] = useState("");
  const [isItemAvailable, setIsItemAvailable] = useState(true);
  const [newItemDescription, setItemDescription] = useState("");
  const [newLocationDet, setLocationDet] = useState("");
  const [itemImage, setItemImage] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const onSubmitItem = async (imageURL) => {
    try {
      const itemData = {
        name: newItemName,
        price: parseFloat(newItemPrice),
        isAvailable: isItemAvailable,
        description: newItemDescription,
        location: newLocationDet,
        images: imageURL ? [imageURL] : [],
        category: 'general', // Default category
        condition: 'good' // Default condition
      };

      const result = await apiService.createItem(itemData);
      if (result.success) {
        alert("Item added successfully!");
        // Reset form fields
        setItemImage(null);
        setItemName('');
        setItemPrice('');
        setItemDescription('');
        setLocationDet('');
        setIsSubmitted(false);
        // Navigate back to homepage
        navigate('/');
      } else {
        alert(`Failed to add item: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add item. Please try again.");
    }
  };

  const uploadImage = async () => {
    setIsSubmitted(true);
    setUploading(true);

    // Validate form fields
    if (!newItemName || !newItemPrice || !newItemDescription || !newLocationDet || !itemImage) {
      alert("Please fill in all the fields.");
      setUploading(false);
      return;
    }

    try {
      // Upload image to S3
      const uploadResult = await apiService.uploadFile(itemImage, 'single');
      
      if (uploadResult.success) {
        // Get the S3 URL from the upload result
        const imageURL = uploadResult.data.url;
        await onSubmitItem(imageURL);
      } else {
        alert(`Failed to upload image: ${uploadResult.error}`);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div id="add-item-page">
      <nav className="navbar">
        <Link to="/" className="nav-link">Home</Link>
      </nav>

      <div className="add-item-container">
      <h2 style={{ color: 'white' }}>Item Details</h2>

        <div className="form-container">
          {/* Name Input */}
          <input
            placeholder="Item Name..."
            onChange={(e) => setItemName(e.target.value)}
            value={newItemName}
            className={isSubmitted && !newItemName ? 'invalid' : ''}
            required
          />

          {/* Price Input */}
          <input
            placeholder="$0"
            type="number"
            step="0.01"
            onChange={(e) => setItemPrice(e.target.value)}
            value={newItemPrice}
            className={isSubmitted && !newItemPrice ? 'invalid' : ''}
            required
          />

          {/* Description Input */}
          <textarea
            className={`description-textarea ${isSubmitted && !newItemDescription ? 'invalid' : ''}`}
            placeholder="Description of Item..."
            onChange={(e) => setItemDescription(e.target.value)}
            value={newItemDescription}
            required
          />

          {/* Location Input */}
          <input
            placeholder="Pickup or Dropoff Details..."
            onChange={(e) => setLocationDet(e.target.value)}
            value={newLocationDet}
            className={isSubmitted && !newLocationDet ? 'invalid' : ''}
            required
          />

          {/* File Input */}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setItemImage(e.target.files[0])}
            className={isSubmitted && !itemImage ? 'invalid' : ''}
            required
          />

          {/* Submit Button */}
          <button 
            onClick={uploadImage} 
            disabled={uploading}
            style={{ opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? 'Uploading...' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddItem;