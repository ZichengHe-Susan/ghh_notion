import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import './styles/Chat.css';

const Chat = ({ conversation, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const { socket, isConnected, typingUsers, sendMessage, startTyping, stopTyping, addReaction, editMessage, deleteMessage } = useSocket();
  const { user } = useAuth();

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !conversation) return;

    const handleNewMessage = (data) => {
      if (data.conversationId === conversation._id) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    const handleMessageEdited = (data) => {
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId 
          ? { ...msg, content: data.newContent, metadata: { ...msg.metadata, isEdited: true, editedAt: data.editedAt } }
          : msg
      ));
    };

    const handleMessageDeleted = (data) => {
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId 
          ? { ...msg, isDeleted: true, deletedAt: data.deletedAt }
          : msg
      ));
    };

    const handleMessageReaction = (data) => {
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId 
          ? { ...msg, reactions: [...(msg.reactions || []), { user: data.userId, emoji: data.emoji, createdAt: new Date() }] }
          : msg
      ));
    };

    const handleOrderUpdate = (data) => {
      if (data.conversationId === conversation._id) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_reaction', handleMessageReaction);
    socket.on('order_update', handleOrderUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_reaction', handleMessageReaction);
      socket.off('order_update', handleOrderUpdate);
    };
  }, [socket, conversation]);

  // Load initial messages
  useEffect(() => {
    if (conversation && conversation.messages) {
      setMessages(conversation.messages);
    }
  }, [conversation]);

  // Handle typing
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      startTyping(conversation._id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(conversation._id);
    }, 1000);
  };

  // Handle send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !isConnected) return;

    const messageData = {
      conversationId: conversation._id,
      content: newMessage.trim(),
      type: 'text',
      replyTo: replyingTo?._id
    };

    sendMessage(messageData);
    setNewMessage('');
    setReplyingTo(null);
    
    // Stop typing
    if (isTyping) {
      setIsTyping(false);
      stopTyping(conversation._id);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/chat/conversations/${conversation._id}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // The message will be automatically added via Socket.IO
        console.log('File uploaded successfully:', data);
      } else {
        console.error('File upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }

    // Clear the input
    e.target.value = '';
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Handle message edit
  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editingMessage) {
      editMessage(editingMessage._id, editContent.trim());
      setEditingMessage(null);
      setEditContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  // Handle message delete
  const handleDeleteMessage = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      deleteMessage(messageId);
    }
  };

  // Handle reaction
  const handleReaction = (messageId, emoji) => {
    addReaction(messageId, emoji);
  };

  // Get typing users for this conversation
  const conversationTypingUsers = typingUsers[conversation._id] || {};
  const typingUserNames = Object.values(conversationTypingUsers)
    .filter(user => user.isTyping)
    .map(user => `${user.user.firstName} ${user.user.lastName}`)
    .join(', ');

  // Get other participant
  const otherParticipant = conversation.participants.find(p => p.user._id !== user.id);

  return (
    <div className="chat-container">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-participant-info">
          <div className="participant-avatar">
            <img 
              src={otherParticipant?.user.avatar || '/default-avatar.png'} 
              alt={otherParticipant?.user.firstName}
            />
          </div>
          <div className="participant-details">
            <h3>{otherParticipant?.user.firstName} {otherParticipant?.user.lastName}</h3>
            <p className="conversation-subject">{conversation.subject}</p>
          </div>
        </div>
        <button className="close-chat-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message._id} className={`message ${message.sender._id === user.id ? 'sent' : 'received'}`}>
            {message.type === 'system' ? (
              <div className="system-message">
                <span>{message.content}</span>
              </div>
            ) : (
              <>
                {replyingTo?._id === message._id && (
                  <div className="reply-preview">
                    <span>Replying to: {message.content.substring(0, 50)}...</span>
                    <button onClick={() => setReplyingTo(null)}>✕</button>
                  </div>
                )}
                
                <div className="message-content">
                  <div className="message-header">
                    <span className="sender-name">{message.sender.firstName} {message.sender.lastName}</span>
                    <span className="message-time">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="message-body">
                    {message.isDeleted ? (
                      <span className="deleted-message">Message deleted</span>
                    ) : (
                      <>
                        {message.content}
                        {message.metadata?.isEdited && (
                          <span className="edited-indicator"> (edited)</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Message attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="message-attachments">
                      {message.attachments.map((attachment, index) => (
                        <div key={index} className="attachment">
                          {attachment.mimeType.startsWith('image/') ? (
                            <img src={attachment.url} alt={attachment.originalName} />
                          ) : (
                            <a href={attachment.url} download={attachment.originalName}>
                              📎 {attachment.originalName}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="message-reactions">
                      {Object.entries(
                        message.reactions.reduce((acc, reaction) => {
                          acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([emoji, count]) => (
                        <button 
                          key={emoji} 
                          className="reaction-btn"
                          onClick={() => handleReaction(message._id, emoji)}
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message actions */}
                  {message.sender._id === user.id && !message.isDeleted && (
                    <div className="message-actions">
                      <button onClick={() => handleReaction(message._id, '👍')}>👍</button>
                      <button onClick={() => handleReaction(message._id, '❤️')}>❤️</button>
                      <button onClick={() => handleReaction(message._id, '😂')}>😂</button>
                      <button onClick={() => handleEditMessage(message)}>Edit</button>
                      <button onClick={() => handleDeleteMessage(message._id)}>Delete</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        
        {/* Typing indicator */}
        {typingUserNames && (
          <div className="typing-indicator">
            <span>{typingUserNames} {typingUserNames.includes(',') ? 'are' : 'is'} typing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form className="message-input-form" onSubmit={handleSendMessage}>
        <div className="input-container">
          <button 
            type="button" 
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
            multiple
          />
          
          <div className="message-input-wrapper">
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="message-input"
              disabled={!isConnected}
            />
            
            <button 
              type="button" 
              className="emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              😊
            </button>
          </div>
          
          <button 
            type="submit" 
            className="send-btn"
            disabled={!newMessage.trim() || !isConnected}
          >
            Send
          </button>
        </div>
        
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map(emoji => (
              <button 
                key={emoji} 
                type="button"
                className="emoji-option"
                onClick={() => handleEmojiSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Edit Message Modal */}
      {editingMessage && (
        <div className="edit-modal">
          <div className="edit-modal-content">
            <h3>Edit Message</h3>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="edit-textarea"
            />
            <div className="edit-actions">
              <button onClick={handleSaveEdit}>Save</button>
              <button onClick={handleCancelEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
