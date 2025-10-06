import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import AddressModal from '../components/AddressModal';
import '../css/Upload.scss';

const AddItem = () => {
  const { currentUser, userData } = useAuth();
  const [itemTitle, setItemTitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemCondition, setItemCondition] = useState("good");
  const [itemImage, setItemImage] = useState(null);
  const [shippingMethods, setShippingMethods] = useState({
    standard: false,
    delivery: false,
    pickup: false,
  });
  const [shippingCost, setShippingCost] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [canSell, setCanSell] = useState(false);
  const [checkingSellStatus, setCheckingSellStatus] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Check if user can sell
  useEffect(() => {
    const checkSellStatus = async () => {
      if (!currentUser) return;
      
      try {
        const response = await apiService.canSell();
        if (response.success) {
          setCanSell(response.data.canSell);
        }
      } catch (error) {
        console.error('Error checking sell status:', error);
      } finally {
        setCheckingSellStatus(false);
      }
    };

    checkSellStatus();
  }, [currentUser]);

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const result = await apiService.getItemCategories();
        console.log('Categories API response:', result);
        
        if (result.success && Array.isArray(result.data)) {
          setCategories(result.data);
        } else {
          console.error('Categories data is not an array:', result);
          setCategories([]);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setCategories([]);
      }
    };
    
    if (currentUser) {
      fetchCategories();
    }
  }, [currentUser]);

  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
  };

  const onSubmitItem = async (imageURL) => {
    try {
      const selectedMethods = Object.keys(shippingMethods).filter(method => shippingMethods[method]);

      // Use selected address
      const itemData = {
        title: itemTitle,
        description: itemDescription,
        price: parseFloat(itemPrice),
        category: itemCategory,
        condition: itemCondition,
        status: 'active', // Set status to active so item shows up
        availability: {
          status: 'available', // Set availability to available
          quantity: 1
        },
        location: {
          address: selectedAddress._id
        },
        images: imageURL ? [{ url: imageURL, alt: itemTitle, isPrimary: true }] : [],
        shipping: {
          shippingMethods: selectedMethods,
          shippingCost: parseFloat(shippingCost) || 0,
          deliveryCost: parseFloat(deliveryCost) || 0,
        }
      };

      console.log('Creating item with data:', itemData);
      const result = await apiService.createItem(itemData);
      console.log('Item creation result:', result);
      if (result.success) {
        alert("Item added successfully!");
        // Reset form fields
        resetForm();
        // Navigate back to homepage
        navigate('/');
      } else {
        alert(`Failed to add item: ${result.error}`);
        if (result.details) {
          console.error('Validation errors:', result.details);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add item. Please try again.");
    }
  };

  const resetForm = () => {
    setItemImage(null);
    setItemTitle('');
    setItemPrice('');
    setItemDescription('');
    setItemCategory('');
    setItemCondition('good');
    setShippingMethods({ standard: false, delivery: false, pickup: false });
    setShippingCost('');
    setDeliveryCost('');
    setIsSubmitted(false);
    setSelectedAddress(null);
  };

  const uploadImage = async () => {
    setIsSubmitted(true);
    setUploading(true);

    // Check if user can sell
    if (!canSell) {
      alert("You must complete Stripe Connect onboarding before listing items for sale. Please set up your payment account first.");
      setUploading(false);
      navigate('/seller/onboarding');
      return;
    }

    // Validate form fields
    if (!itemTitle || !itemPrice || !itemDescription || !itemCategory || !itemImage) {
      alert("Please fill in all the required fields.");
      setUploading(false);
      return;
    }

    // Validate address selection
    if (!selectedAddress) {
      alert("Please select an address from your address book.");
      setUploading(false);
      return;
    }

    // Validate price
    const price = parseFloat(itemPrice);
    if (isNaN(price) || price < 0) {
      alert("Please enter a valid price.");
      setUploading(false);
      return;
    }

    if (shippingMethods.standard && (isNaN(parseFloat(shippingCost)) || parseFloat(shippingCost) < 0)) {
      alert("Please enter a valid shipping cost.");
      setUploading(false);
      return;
    }

    if (shippingMethods.delivery && (isNaN(parseFloat(deliveryCost)) || parseFloat(deliveryCost) < 0)) {
      alert("Please enter a valid delivery cost.");
      setUploading(false);
      return;
    }

    try {
      // Upload image to S3
      const uploadResult = await apiService.uploadFile(itemImage, 'single');
      
      if (uploadResult.success) {
        // Get the S3 URL from the upload result
        console.log('Upload result:', uploadResult);
        const imageURL = uploadResult.data.url;
        console.log('Extracted image URL:', imageURL);
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

  if (checkingSellStatus) {
    return (
      <div id="add-item-page">
        <nav className="navbar">
          <Link to="/" className="nav-link">Home</Link>
        </nav>
        <div className="add-item-container">
          <h2 style={{ color: 'white' }}>Checking seller status...</h2>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: 'white' }}>Please wait while we verify your seller account.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canSell) {
    return (
      <div id="add-item-page">
        <nav className="navbar">
          <Link to="/" className="nav-link">Home</Link>
        </nav>
        <div className="add-item-container">
          <h2 style={{ color: 'white' }}>Payment Account Required</h2>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: 'white', marginBottom: '20px' }}>
              To list items for sale, you must first set up a payment account with Stripe Connect.
            </p>
            <button 
              onClick={() => navigate('/seller/onboarding')}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Set Up Payment Account
            </button>
            <button 
              onClick={() => navigate('/')}
              style={{
                backgroundColor: 'transparent',
                color: 'white',
                border: '2px solid white',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="add-item-page">
      <nav className="navbar">
        <Link to="/" className="nav-link">Home</Link>
      </nav>

      <div className="add-item-container">
      <h2 style={{ color: 'white' }}>Item Details</h2>

        <div className="form-container">
          {/* Title Input */}
          <input
            placeholder="Item Title..."
            onChange={(e) => setItemTitle(e.target.value)}
            value={itemTitle}
            className={isSubmitted && !itemTitle ? 'invalid' : ''}
            required
          />

          {/* Price Input */}
          <input
            placeholder="$0.00"
            type="number"
            step="0.01"
            min="0"
            onChange={(e) => setItemPrice(e.target.value)}
            value={itemPrice}
            className={isSubmitted && !itemPrice ? 'invalid' : ''}
            required
          />

          {/* Description Input */}
          <textarea
            className={`description-textarea ${isSubmitted && !itemDescription ? 'invalid' : ''}`}
            placeholder="Description of Item (minimum 10 characters)..."
            onChange={(e) => setItemDescription(e.target.value)}
            value={itemDescription}
            required
          />

          {/* Category Selection */}
          <select
            onChange={(e) => setItemCategory(e.target.value)}
            value={itemCategory}
            className={isSubmitted && !itemCategory ? 'invalid' : ''}
            required
          >
            <option value="">Select Category</option>
            {Array.isArray(categories) && categories.map(category => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>

          {/* Condition Selection */}
          <select
            onChange={(e) => setItemCondition(e.target.value)}
            value={itemCondition}
            required
          >
            <option value="new">New</option>
            <option value="like_new">Like New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>

          {/* Shipping Options */}
          <div className="shipping-options">
            <h4>Available Delivery Methods</h4>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={shippingMethods.standard}
                  onChange={() => setShippingMethods(prev => ({ ...prev, standard: !prev.standard }))}
                />
                Shipping (e.g., USPS, FedEx)
              </label>
              {shippingMethods.standard && (
                <input
                  type="number"
                  placeholder="Shipping Cost"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  className="cost-input"
                />
              )}
            </div>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={shippingMethods.delivery}
                  onChange={() => setShippingMethods(prev => ({ ...prev, delivery: !prev.delivery }))}
                />
                Local Delivery (Seller delivers)
              </label>
              {shippingMethods.delivery && (
                <input
                  type="number"
                  placeholder="Delivery Cost"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  className="cost-input"
                />
              )}
            </div>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={shippingMethods.pickup}
                  onChange={() => setShippingMethods(prev => ({ ...prev, pickup: !prev.pickup }))}
                />
                Local Pickup (Buyer collects)
              </label>
            </div>
          </div>

          {/* Address Selection */}
          <div className="address-selection">
            <button 
              type="button" 
              className="select-address-btn"
              onClick={() => setShowAddressModal(true)}
            >
              {selectedAddress ? `Selected: ${selectedAddress.label || selectedAddress.contactInfo?.firstName + ' ' + selectedAddress.contactInfo?.lastName}` : 'Select from Address Book'}
            </button>
            {selectedAddress && (
              <button 
                type="button" 
                className="clear-address-btn"
                onClick={() => {
                  setSelectedAddress(null);
                }}
              >
                Clear Selection
              </button>
            )}
          </div>

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

      {/* Address Modal */}
      <AddressModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSelectAddress={handleAddressSelect}
        selectedAddressId={selectedAddress?._id}
        title="Select Item Location Address"
        allowSave={true}
      />
    </div>
  );
};

export default AddItem;