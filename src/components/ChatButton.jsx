import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import './styles/ChatButton.css';

const ChatButton = ({ onClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const { user, token } = useAuth();
  const { isConnected } = useSocket();

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/chat/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    if (user && token) {
      setIsVisible(true);
      fetchUnreadCount();
      
      // Poll for unread count updates every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    } else {
      setIsVisible(false);
    }
  }, [user, token]);

  // Update unread count when new messages arrive
  useEffect(() => {
    if (!isConnected) return;

    const handleNewMessage = () => {
      setUnreadCount(prev => prev + 1);
    };

    // Listen for new messages (this would be set up in SocketContext)
    // For now, we'll just show the button if user is logged in
    return () => {
      // Cleanup if needed
    };
  }, [isConnected]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="chat-button-container">
      <button 
        className={`chat-button ${unreadCount > 0 ? 'has-unread' : ''} ${!isConnected ? 'disconnected' : ''}`}
        onClick={onClick}
        title={unreadCount > 0 ? `${unreadCount} unread messages` : 'Open chat'}
      >
        <div className="chat-icon">
          💬
        </div>
        
        {unreadCount > 0 && (
          <div className="unread-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
        
        {!isConnected && (
          <div className="connection-indicator">
            <div className="connection-dot"></div>
          </div>
        )}
      </button>
      
      {/* Tooltip */}
      <div className="chat-tooltip">
        {unreadCount > 0 ? `${unreadCount} unread messages` : 'Open chat'}
      </div>
    </div>
  );
};

export default ChatButton;
