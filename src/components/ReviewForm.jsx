import React, { useState, useEffect } from 'react';
import './styles/ReviewForm.css';

const ReviewForm = ({ 
  orderId, 
  orderData, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  initialData = null 
}) => {
  const [formData, setFormData] = useState({
    rating: 5,
    title: '',
    comment: '',
    categoryRatings: {
      communication: null,
      itemCondition: null,
      shipping: null,
      value: null
    },
    images: [],
    anonymous: false
  });
  const [errors, setErrors] = useState({});
  const [imageFiles, setImageFiles] = useState([]);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        categoryRatings: initialData.categoryRatings || prev.categoryRatings
      }));
    }
  }, [initialData]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('categoryRatings.')) {
      const category = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        categoryRatings: {
          ...prev.categoryRatings,
          [category]: value ? parseInt(value) : null
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imageFiles.length > 5) {
      setErrors(prev => ({ 
        ...prev, 
        images: 'Maximum 5 images allowed' 
      }));
      return;
    }

    setImageFiles(prev => [...prev, ...files]);
    
    // Create preview URLs
    const newImages = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
      alt: ''
    }));
    
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newImages]
    }));
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Review title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!formData.comment.trim()) {
      newErrors.comment = 'Review comment is required';
    } else if (formData.comment.length < 10) {
      newErrors.comment = 'Comment must be at least 10 characters';
    }

    if (formData.rating < 1 || formData.rating > 5) {
      newErrors.rating = 'Please select a valid rating';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const submitData = {
        ...formData,
        orderId,
        images: formData.images.map(img => ({
          url: img.url,
          alt: img.alt || ''
        }))
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting review:', error);
    }
  };

  const renderStars = (rating, onChange) => {
    return Array.from({ length: 5 }, (_, index) => (
      <button
        key={index}
        type="button"
        className={`star-button ${index < rating ? 'filled' : 'empty'}`}
        onClick={() => onChange(index + 1)}
        onMouseEnter={() => onChange(index + 1)}
      >
        ★
      </button>
    ));
  };

  const renderCategoryStars = (category, value, onChange) => {
    return (
      <div className="category-rating-input">
        <label className="category-label">
          {category === 'communication' && 'Communication'}
          {category === 'itemCondition' && 'Item Condition'}
          {category === 'shipping' && 'Shipping'}
          {category === 'value' && 'Value for Money'}
        </label>
        <div className="category-stars">
          {Array.from({ length: 5 }, (_, index) => (
            <button
              key={index}
              type="button"
              className={`star-button small ${index < (value || 0) ? 'filled' : 'empty'}`}
              onClick={() => onChange(index + 1)}
            >
              ★
            </button>
          ))}
          <button
            type="button"
            className="clear-rating"
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        </div>
      </div>
    );
  };

  if (!orderData) {
    return (
      <div className="review-form-loading">
        <p>Loading order information...</p>
      </div>
    );
  }

  return (
    <div className="review-form-container">
      <div className="review-form-header">
        <h2>Write a Review</h2>
        <div className="order-info">
          <h3>Order #{orderData.orderNumber}</h3>
          <div className="item-info">
            {orderData.items && orderData.items[0] && (
              <>
                {orderData.items[0].itemSnapshot?.images && (
                  <img 
                    src={orderData.items[0].itemSnapshot.images[0]} 
                    alt={orderData.items[0].itemSnapshot.title}
                    className="item-thumbnail"
                  />
                )}
                <div className="item-details">
                  <h4>{orderData.items[0].itemSnapshot?.title}</h4>
                  <p>Sold by: {orderData.seller?.firstName} {orderData.seller?.lastName}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="review-form">
        <div className="form-section">
          <label className="form-label">
            Overall Rating *
            <div className="rating-input">
              {renderStars(formData.rating, (rating) => 
                setFormData(prev => ({ ...prev, rating }))
              )}
              <span className="rating-text">
                {formData.rating === 1 && 'Poor'}
                {formData.rating === 2 && 'Fair'}
                {formData.rating === 3 && 'Good'}
                {formData.rating === 4 && 'Very Good'}
                {formData.rating === 5 && 'Excellent'}
              </span>
            </div>
          </label>
          {errors.rating && <span className="error-message">{errors.rating}</span>}
        </div>

        <div className="form-section">
          <label className="form-label">
            Review Title *
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Summarize your experience in a few words"
              className={`form-input ${errors.title ? 'error' : ''}`}
              maxLength={100}
            />
          </label>
          {errors.title && <span className="error-message">{errors.title}</span>}
          <div className="character-count">
            {formData.title.length}/100
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">
            Your Review *
            <textarea
              name="comment"
              value={formData.comment}
              onChange={handleInputChange}
              placeholder="Tell others about your experience with this item and seller..."
              className={`form-textarea ${errors.comment ? 'error' : ''}`}
              rows={6}
              maxLength={1000}
            />
          </label>
          {errors.comment && <span className="error-message">{errors.comment}</span>}
          <div className="character-count">
            {formData.comment.length}/1000
          </div>
        </div>

        <div className="form-section">
          <h4 className="section-title">Detailed Ratings (Optional)</h4>
          <div className="category-ratings">
            {renderCategoryStars('communication', formData.categoryRatings.communication, 
              (rating) => setFormData(prev => ({
                ...prev,
                categoryRatings: { ...prev.categoryRatings, communication: rating }
              }))
            )}
            {renderCategoryStars('itemCondition', formData.categoryRatings.itemCondition,
              (rating) => setFormData(prev => ({
                ...prev,
                categoryRatings: { ...prev.categoryRatings, itemCondition: rating }
              }))
            )}
            {renderCategoryStars('shipping', formData.categoryRatings.shipping,
              (rating) => setFormData(prev => ({
                ...prev,
                categoryRatings: { ...prev.categoryRatings, shipping: rating }
              }))
            )}
            {renderCategoryStars('value', formData.categoryRatings.value,
              (rating) => setFormData(prev => ({
                ...prev,
                categoryRatings: { ...prev.categoryRatings, value: rating }
              }))
            )}
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">
            Photos (Optional)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="file-input"
            />
            <div className="file-input-label">
              <span>Choose up to 5 photos</span>
            </div>
          </label>
          {errors.images && <span className="error-message">{errors.images}</span>}
          
          {formData.images.length > 0 && (
            <div className="image-previews">
              {formData.images.map((image, index) => (
                <div key={index} className="image-preview">
                  <img src={image.url} alt={`Preview ${index + 1}`} />
                  <button
                    type="button"
                    className="remove-image"
                    onClick={() => removeImage(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="anonymous"
              checked={formData.anonymous}
              onChange={handleInputChange}
            />
            <span className="checkbox-text">
              Post this review anonymously
            </span>
          </label>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;
