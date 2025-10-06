import React, { useState, useEffect } from 'react';
import { Modal, Typography, Button, Tabs, Tab, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import ListedItems from '../components/ListedItems'; // Import the refactored ListedItems component
import OrderHistory from '../components/OrderHistory';
import EditProfile from '../components/EditProfile';
import '../css/profile.scss'; 
import CloseIcon from '@mui/icons-material/Close';

const ProfileModal = ({ showProfile, handleClose }) => {
  const [open, setOpen] = useState(showProfile);
  const { currentUser, userData } = useAuth();
  const [userItems, setUserItems] = useState([]);
  const [activeTab, setActiveTab] = useState(0); // State to track active tab
  const [itemBought, setItemBought] = useState(0);
  const [itemSold, setItemSold] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOpen(showProfile);
  }, [showProfile]);

  useEffect(() => {
    if (currentUser) {
      const fetchUserItems = async () => {
        try {
          setLoading(true);
          const result = await apiService.getItemsBySeller(currentUser.id);
          if (result.success && result.data) {
            // Handle both array and object response structures
            const items = Array.isArray(result.data) ? result.data : result.data.items || [];
            setUserItems(items);
            
            // Count sold items (items with sold status or order info)
            const soldCount = items.filter(item => 
              item.availability?.status === 'sold' || 
              item.status === 'sold' || 
              item.availability?.quantity === 0 ||
              item.orderInfo
            ).length;
            setItemSold(soldCount);
            
            // For now, set bought items to 0 since we don't have a specific endpoint
            // You can implement this later when you have order history
            setItemBought(0);
          } else {
            console.error('Error fetching user items:', result.error);
            setUserItems([]);
          }
        } catch (err) {
          console.error('Error fetching user items:', err);
          setUserItems([]);
        } finally {
          setLoading(false);
        }
      };
  
      fetchUserItems();
    }
  }, [currentUser]);
  

  if (!currentUser || !userData) {
    return null;
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const calculateJoinedDuration = (createdAt) => {
    if (!createdAt) return 'Recently';
    
    const now = new Date();
    const joinedDate = new Date(createdAt);

    const yearsDiff = now.getFullYear() - joinedDate.getFullYear();
    const monthsDiff = now.getMonth() - joinedDate.getMonth();
    const daysDiff = now.getDate() - joinedDate.getDate();

    if (yearsDiff > 1) {
      return `${yearsDiff} years ${Math.abs(monthsDiff)} months`;
    } else if (yearsDiff === 1) {
      return `1 year ${Math.abs(monthsDiff)} months`;
    } else if (monthsDiff > 1) {
      return `${monthsDiff} months ${Math.abs(daysDiff)} days`;
    } else if (monthsDiff === 1) {
      return `1 month ${Math.abs(daysDiff)} days`;
    } else if (daysDiff > 1) {
      return `${Math.abs(daysDiff)} days`;
    } else if (daysDiff === 0) {
      return `Today`;
    } else {
      return `${Math.abs(daysDiff)} days`;
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="profile-modal-title"
      aria-describedby="profile-modal-description"
    >
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-header-text">
            <div id="profile-modal-title" className="modal-title">
              Hoo-rah-ray, ray, ray!
            </div>
            <div className="modal-name">{userData.displayName}</div>
            <Typography className="modal-description">
              Email: {userData.email}
            </Typography>
          </div>

          <div className="modal-description-wrapper">
            <div className="modal-description">Joined</div>
            <div className="modal-data">{calculateJoinedDuration(userData.createdAt)}</div>
          </div>
          <div className="modal-description-wrapper">
            <div className="modal-description">
                Rehomed
            </div>
            <div className="modal-data">
                {itemSold}
            </div>
            <div className="modal-description">
                treasures
            </div>
          </div>
          <div className="modal-description-wrapper">
            <div className="modal-description">
                Revived 
            </div>
            <div className="modal-data">
                {itemBought}
            </div>
            <div className="modal-description">
            past pieces
            </div>
          </div>

          <Button className="close-button" onClick={handleClose}>
            <CloseIcon />
          </Button>
        </div>

        {/* Sticky Tabs Container */}
        <div className="modal-sticky-tabs">
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }} className="tabs-container">
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="Listed Items" />
              <Tab label="Order History" />
              <Tab label="Edit Profile" />
            </Tabs>
          </Box>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 0 && <ListedItems userItems={userItems} />}
          {activeTab === 1 && <OrderHistory />}
          {activeTab === 2 && <EditProfile />}
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;