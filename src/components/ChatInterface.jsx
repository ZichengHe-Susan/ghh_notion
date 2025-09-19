import React, { useState, useEffect } from 'react';
import ConversationList from './ConversationList';
import Chat from './Chat';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import './styles/ChatInterface.css';

const ChatInterface = ({ onClose }) => {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const { socket, isConnected } = useSocket();
  const { user, token } = useAuth();

  // Fetch unread count
  const fetchUnreadCount = async () => {
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
    if (token) {
      fetchUnreadCount();
    }
  }, [token]);

  // Socket event listeners for unread count updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      // Only update unread count if the message is not from current user
      if (data.message.sender._id !== user.id) {
        setUnreadCount(prev => prev + 1);
      }
    };

    const handleConversationRead = () => {
      setUnreadCount(prev => Math.max(0, prev - 1));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_read', handleConversationRead);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_read', handleConversationRead);
    };
  }, [socket, user.id]);

  // Handle conversation selection
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
    
    // Update unread count when conversation is selected
    if (conversation.unreadCount) {
      const userParticipant = conversation.participants.find(p => p.user._id === user.id);
      if (userParticipant) {
        const userUnreadCount = userParticipant.role === 'buyer' 
          ? conversation.unreadCount.buyer 
          : conversation.unreadCount.seller;
        
        if (userUnreadCount > 0) {
          setUnreadCount(prev => Math.max(0, prev - userUnreadCount));
        }
      }
    }
  };

  // Handle back to conversation list on mobile
  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
  };

  // Handle close chat interface
  const handleClose = () => {
    setSelectedConversation(null);
    setShowMobileChat(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="chat-interface">
      {/* Desktop Layout */}
      <div className="chat-interface-desktop">
        <div className="chat-sidebar">
          <ConversationList 
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversation?._id}
          />
        </div>
        
        <div className="chat-main">
          {selectedConversation ? (
            <Chat 
              conversation={selectedConversation}
              onClose={handleClose}
            />
          ) : (
            <div className="chat-placeholder">
              <div className="placeholder-content">
                <div className="placeholder-icon">💬</div>
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="chat-interface-mobile">
        {!showMobileChat ? (
          <ConversationList 
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversation?._id}
          />
        ) : (
          <div className="mobile-chat">
            <div className="mobile-chat-header">
              <button className="back-btn" onClick={handleBackToList}>
                ← Back
              </button>
              <h3>Chat</h3>
              <button className="close-btn" onClick={handleClose}>
                ✕
              </button>
            </div>
            <Chat 
              conversation={selectedConversation}
              onClose={handleClose}
            />
          </div>
        )}
      </div>

      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="connection-banner">
          <div className="connection-content">
            <div className="connection-icon">⚠️</div>
            <span>Connection lost. Attempting to reconnect...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
