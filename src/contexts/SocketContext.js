import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import config from '../config/environment';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const { currentUser } = useAuth();
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (currentUser) {
      const token = localStorage.getItem('token');
      if (!token) return;

      const newSocket = io(config.SOCKET_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      // Connection events
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        setOnlineUsers(new Set());
        reconnectAttemptsRef.current = 0;
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        
        // Attempt to reconnect if not a manual disconnect
        if (reason !== 'io client disconnect' && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            newSocket.connect();
          }, delay);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // User presence events
      newSocket.on('user_online', (data) => {
        setOnlineUsers(prev => new Set([...prev, data.userId]));
      });

      newSocket.on('user_offline', (data) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
      });

      // Typing indicators
      newSocket.on('user_typing', (data) => {
        setTypingUsers(prev => ({
          ...prev,
          [data.conversationId]: {
            ...prev[data.conversationId],
            [data.userId]: {
              user: data.user,
              isTyping: data.isTyping,
              timestamp: Date.now()
            }
          }
        }));

        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => ({
            ...prev,
            [data.conversationId]: {
              ...prev[data.conversationId],
              [data.userId]: {
                ...prev[data.conversationId]?.[data.userId],
                isTyping: false
              }
            }
          }));
        }, 3000);
      });

      // Error handling
      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      setSocket(newSocket);

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers(new Set());
        setTypingUsers({});
      };
    }
  }, [currentUser]);

  // Socket utility functions
  const joinConversation = (conversationId) => {
    if (socket && isConnected) {
      socket.emit('join_conversation', conversationId);
    }
  };

  const leaveConversation = (conversationId) => {
    if (socket && isConnected) {
      socket.emit('leave_conversation', conversationId);
    }
  };

  const sendMessage = (data) => {
    if (socket && isConnected) {
      socket.emit('send_message', data);
    }
  };

  const startTyping = (conversationId) => {
    if (socket && isConnected) {
      socket.emit('typing_start', { conversationId });
    }
  };

  const stopTyping = (conversationId) => {
    if (socket && isConnected) {
      socket.emit('typing_stop', { conversationId });
    }
  };

  const addReaction = (messageId, emoji) => {
    if (socket && isConnected) {
      socket.emit('add_reaction', { messageId, emoji });
    }
  };

  const editMessage = (messageId, newContent) => {
    if (socket && isConnected) {
      socket.emit('edit_message', { messageId, newContent });
    }
  };

  const deleteMessage = (messageId) => {
    if (socket && isConnected) {
      socket.emit('delete_message', { messageId });
    }
  };

  const sendOrderUpdate = (data) => {
    if (socket && isConnected) {
      socket.emit('order_update', data);
    }
  };

  const ping = () => {
    if (socket && isConnected) {
      socket.emit('ping');
    }
  };

  const value = {
    socket,
    isConnected,
    onlineUsers,
    typingUsers,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    addReaction,
    editMessage,
    deleteMessage,
    sendOrderUpdate,
    ping
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
