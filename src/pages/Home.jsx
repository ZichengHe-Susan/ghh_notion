import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Item from '../Item';
import DetailedItem from '../DetailedItem'; 
import backgroundImage from '../assets/old-cabell.jpg';
import '../css/Home.css';
import ProfileModal from './ProfileModal';
import ViewItems from './ViewItems';
import Copyright from '../components/Copyright';

const Home = () => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate(); 
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const handleScroll = () => {
    const position = window.scrollY;
    setScrollPosition(position);
    if (position > 300) {
      setShowDetails(true);
    } else {
      setShowDetails(false);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout(); 
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const handleUpload = async () => {
    try {
      navigate('/upload');
    } catch (error) {
      console.error('Failed to render:', error);
    }
  };

  const navigateCart = async () => {
    try {
      navigate('/cart');
    } catch (error) {
      console.error('Failed to navigate to shopping cart:', error);
    }
  };

  const [selectedItem, setSelectedItem] = useState(null);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
  };

  const style = {
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div>
      <header className="home-header">
        <h1>Welcome to the UVA Thrift Store</h1>
      </header>

      <div className="button-container">
        <button onClick={handleUpload}>Add Item</button>
        <button onClick={() => setShowProfile(true)}>Profile</button> 
        <button onClick={navigateCart}>Shopping Cart</button>
        <button onClick={handleLogout}>Log Out</button>
      </div>
      <div className ="view-items-padding">
      <h1 className="view-items-title">Discover unique secondhand items</h1>
      <ViewItems />
      </div>

      <Copyright/>

      <ProfileModal showProfile={showProfile} handleClose={() => setShowProfile(false)} />
    </div>
  );
};

export default Home;