import React, { useState, useEffect } from 'react';
import './styles/ReviewDisplay.css';

const ReviewDisplay = ({ 
  reviews, 
  showItemInfo = true, 
  showHelpfulButton = true, 
  currentUserId = null,
  onMarkHelpful = null,
  onRemoveHelpful = null 
}) => {
  const [helpfulStates, setHelpfulStates] = useState({});

  useEffect(() => {
    // Initialize helpful states
    const states = {};
    reviews.forEach(review => {
      if (currentUserId && review.helpful && review.helpful.users) {
        states[review._id] = review.helpful.users.some(
          user => user.user.toString() === currentUserId
        );
      }
    });
    setHelpfulStates(states);
  }, [reviews, currentUserId]);

  const handleHelpfulClick = async (reviewId) => {
    if (!onMarkHelpful || !onRemoveHelpful) return;

    const isCurrentlyHelpful = helpfulStates[reviewId];
    
    try {
      if (isCurrentlyHelpful) {
        await onRemoveHelpful(reviewId);
        setHelpfulStates(prev => ({ ...prev, [reviewId]: false }));
      } else {
        await onMarkHelpful(reviewId);
        setHelpfulStates(prev => ({ ...prev, [reviewId]: true }));
      }
    } catch (error) {
      console.error('Error updating helpful status:', error);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <span
        key={index}
        className={`star ${index < rating ? 'filled' : 'empty'}`}
      >
        ★
      </span>
    ));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderCategoryRatings = (categories) => {
    if (!categories) return null;

    const categoryLabels = {
      communication: 'Communication',
      itemCondition: 'Item Condition',
      shipping: 'Shipping',
      value: 'Value for Money'
    };

    return (
      <div className="category-ratings">
        {Object.entries(categories).map(([key, rating]) => {
          if (rating === null || rating === undefined) return null;
          return (
            <div key={key} className="category-rating">
              <span className="category-label">{categoryLabels[key]}:</span>
              <div className="category-stars">
                {renderStars(rating)}
                <span className="rating-number">({rating})</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!reviews || reviews.length === 0) {
    return (
      <div className="no-reviews">
        <p>No reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="review-display">
      {reviews.map((review) => (
        <div key={review._id} className="review-card">
          <div className="review-header">
            <div className="reviewer-info">
              <div className="reviewer-avatar">
                {review.reviewer.avatar ? (
                  <img 
                    src={review.reviewer.avatar} 
                    alt={`${review.reviewer.firstName} ${review.reviewer.lastName}`}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {review.reviewer.firstName.charAt(0)}{review.reviewer.lastName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="reviewer-details">
                <h4 className="reviewer-name">
                  {review.metadata?.anonymous ? 'Anonymous' : 
                   `${review.reviewer.firstName} ${review.reviewer.lastName}`}
                </h4>
                <div className="review-meta">
                  <span className="review-date">{formatDate(review.createdAt)}</span>
                  {review.metadata?.verifiedPurchase && (
                    <span className="verified-badge">✓ Verified Purchase</span>
                  )}
                </div>
              </div>
            </div>
            <div className="review-rating">
              <div className="overall-rating">
                {renderStars(review.rating.overall)}
                <span className="rating-number">{review.rating.overall}</span>
              </div>
            </div>
          </div>

          <div className="review-content">
            <h3 className="review-title">{review.title}</h3>
            <p className="review-comment">{review.comment}</p>
            
            {renderCategoryRatings(review.rating.categories)}

            {review.images && review.images.length > 0 && (
              <div className="review-images">
                {review.images.map((image, index) => (
                  <img
                    key={index}
                    src={image.url}
                    alt={image.alt || 'Review image'}
                    className="review-image"
                  />
                ))}
              </div>
            )}
          </div>

          {showItemInfo && review.item && (
            <div className="review-item-info">
              <h5>Item Reviewed:</h5>
              <div className="item-summary">
                {review.item.images && review.item.images.length > 0 && (
                  <img 
                    src={review.item.images[0]} 
                    alt={review.item.title}
                    className="item-image"
                  />
                )}
                <span className="item-title">{review.item.title}</span>
              </div>
            </div>
          )}

          {review.response && review.response.content && (
            <div className="review-response">
              <h5>Seller Response:</h5>
              <p>{review.response.content}</p>
              <span className="response-date">
                {formatDate(review.response.respondedAt)}
              </span>
            </div>
          )}

          <div className="review-footer">
            <div className="review-stats">
              <span className="helpful-count">
                {review.helpful?.count || 0} people found this helpful
              </span>
              <span className="view-count">
                {review.analytics?.views || 0} views
              </span>
            </div>

            {showHelpfulButton && currentUserId && (
              <button
                className={`helpful-button ${helpfulStates[review._id] ? 'active' : ''}`}
                onClick={() => handleHelpfulClick(review._id)}
              >
                {helpfulStates[review._id] ? '✓ Helpful' : 'Helpful'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewDisplay;
