import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import './styles/ConversationList.css';

const ConversationList = ({ onSelectConversation, selectedConversationId }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  
  const { socket, isConnected, onlineUsers } = useSocket();
  const { user, token } = useAuth();

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/chat/conversations?status=${filterStatus}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [token, filterStatus]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      setConversations(prev => prev.map(conv => 
        conv._id === data.conversationId 
          ? {
              ...conv,
              lastMessage: {
                content: data.message.content,
                sender: data.message.sender,
                timestamp: data.message.createdAt,
                type: data.message.type
              },
              messageCount: conv.messageCount + 1,
              unreadCount: {
                ...conv.unreadCount,
                [conv.participants.find(p => p.user._id !== data.message.sender._id)?.role]: 
                  (conv.unreadCount[conv.participants.find(p => p.user._id !== data.message.sender._id)?.role] || 0) + 1
              }
            }
          : conv
      ));
    };

    const handleConversationCreated = (data) => {
      setConversations(prev => [data.conversation, ...prev]);
    };

    const handleOrderUpdate = (data) => {
      setConversations(prev => prev.map(conv => 
        conv._id === data.conversationId 
          ? {
              ...conv,
              lastMessage: {
                content: data.message.content,
                sender: data.message.sender,
                timestamp: data.message.createdAt,
                type: data.message.type
              }
            }
          : conv
      ));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_created', handleConversationCreated);
    socket.on('order_update', handleOrderUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_created', handleConversationCreated);
      socket.off('order_update', handleOrderUpdate);
    };
  }, [socket]);

  // Search conversations
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get unread count for user
  const getUserUnreadCount = (conversation) => {
    const userParticipant = conversation.participants.find(p => p.user._id === user.id);
    if (!userParticipant) return 0;
    
    return userParticipant.role === 'buyer' 
      ? conversation.unreadCount.buyer 
      : conversation.unreadCount.seller;
  };

  // Format last message time
  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return messageTime.toLocaleDateString();
    }
  };

  // Get other participant
  const getOtherParticipant = (conversation) => {
    return conversation.participants.find(p => p.user._id !== user.id);
  };

  // Check if other participant is online
  const isOtherParticipantOnline = (conversation) => {
    const otherParticipant = getOtherParticipant(conversation);
    return otherParticipant && onlineUsers.has(otherParticipant.user._id);
  };

  if (loading) {
    return (
      <div className="conversation-list">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {/* Header */}
      <div className="conversation-header">
        <h2>Messages</h2>
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="conversation-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filterStatus === 'active' ? 'active' : ''}`}
            onClick={() => setFilterStatus('active')}
          >
            Active
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'archived' ? 'active' : ''}`}
            onClick={() => setFilterStatus('archived')}
          >
            Archived
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
        </div>
      </div>

      {/* Conversations */}
      <div className="conversations-container">
        {filteredConversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>No conversations found</h3>
            <p>
              {searchQuery 
                ? 'Try adjusting your search terms'
                : filterStatus === 'active'
                  ? 'Start a conversation by placing an order'
                  : 'No archived conversations'
              }
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const otherParticipant = getOtherParticipant(conversation);
            const unreadCount = getUserUnreadCount(conversation);
            const isSelected = selectedConversationId === conversation._id;
            const isOnline = isOtherParticipantOnline(conversation);

            return (
              <div
                key={conversation._id}
                className={`conversation-item ${isSelected ? 'selected' : ''} ${unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="conversation-avatar">
                  <img 
                    src={otherParticipant?.user.avatar || '/default-avatar.png'} 
                    alt={otherParticipant?.user.firstName}
                  />
                  {isOnline && <div className="online-indicator"></div>}
                </div>

                <div className="conversation-content">
                  <div className="conversation-header">
                    <h4 className="participant-name">
                      {otherParticipant?.user.firstName} {otherParticipant?.user.lastName}
                    </h4>
                    <span className="last-message-time">
                      {formatLastMessageTime(conversation.lastMessage?.timestamp)}
                    </span>
                  </div>

                  <div className="conversation-subject">
                    {conversation.subject}
                  </div>

                  <div className="last-message">
                    {conversation.lastMessage ? (
                      <>
                        <span className="last-message-sender">
                          {conversation.lastMessage.sender._id === user.id ? 'You: ' : ''}
                        </span>
                        <span className="last-message-content">
                          {conversation.lastMessage.type === 'image' ? '📷 Image' :
                           conversation.lastMessage.type === 'file' ? '📎 File' :
                           conversation.lastMessage.content}
                        </span>
                      </>
                    ) : (
                      <span className="no-messages">No messages yet</span>
                    )}
                  </div>
                </div>

                <div className="conversation-meta">
                  {unreadCount > 0 && (
                    <div className="unread-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                  
                  <div className="conversation-status">
                    {conversation.status === 'archived' && <span className="archived-indicator">📁</span>}
                    {conversation.status === 'blocked' && <span className="blocked-indicator">🚫</span>}
                    {conversation.status === 'resolved' && <span className="resolved-indicator">✅</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
