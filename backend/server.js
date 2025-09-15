const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const PORT = config.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
  cors: {
    origin: config.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] // Replace with your production domain
      : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Store active users and their socket connections
const activeUsers = new Map();
const userRooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`User ${socket.user.firstName} ${socket.user.lastName} connected with socket ${socket.id}`);
  
  // Add user to active users
  activeUsers.set(socket.userId, {
    socketId: socket.id,
    user: socket.user,
    connectedAt: new Date(),
    lastSeen: new Date()
  });

  // Join user to their personal room
  socket.join(`user_${socket.userId}`);
  
  // Emit user online status to all users
  socket.broadcast.emit('user_online', {
    userId: socket.userId,
    user: {
      _id: socket.user._id,
      firstName: socket.user.firstName,
      lastName: socket.user.lastName,
      avatar: socket.user.avatar
    }
  });

  // Handle joining conversation rooms
  socket.on('join_conversation', async (conversationId) => {
    try {
      const Conversation = require('./models/Conversation');
      const conversation = await Conversation.findById(conversationId)
        .populate('participants.user', 'firstName lastName avatar')
        .populate('order')
        .populate('item');

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(
        p => p.user._id.toString() === socket.userId
      );

      if (!isParticipant) {
        socket.emit('error', { message: 'Not authorized to join this conversation' });
        return;
      }

      // Join conversation room
      socket.join(`conversation_${conversationId}`);
      
      // Track user's rooms
      if (!userRooms.has(socket.userId)) {
        userRooms.set(socket.userId, new Set());
      }
      userRooms.get(socket.userId).add(conversationId);

      // Mark messages as read
      await conversation.updateLastRead(socket.userId);

      // Emit conversation joined event
      socket.emit('conversation_joined', {
        conversationId,
        conversation: conversation
      });

      // Notify other participants
      socket.to(`conversation_${conversationId}`).emit('user_joined_conversation', {
        userId: socket.userId,
        user: {
          _id: socket.user._id,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          avatar: socket.user.avatar
        }
      });

      logger.info(`User ${socket.userId} joined conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  // Handle leaving conversation rooms
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    
    if (userRooms.has(socket.userId)) {
      userRooms.get(socket.userId).delete(conversationId);
    }

    // Notify other participants
    socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
      userId: socket.userId,
      user: {
        _id: socket.user._id,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName
      }
    });

    logger.info(`User ${socket.userId} left conversation ${conversationId}`);
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, content, type = 'text', replyTo, attachments } = data;
      
      const Conversation = require('./models/Conversation');
      const Message = require('./models/Message');
      
      // Verify conversation exists and user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const isParticipant = conversation.participants.some(
        p => p.user.toString() === socket.userId
      );

      if (!isParticipant) {
        socket.emit('error', { message: 'Not authorized to send messages' });
        return;
      }

      // Create message
      const message = new Message({
        conversation: conversationId,
        sender: socket.userId,
        content,
        type,
        replyTo,
        attachments: attachments || []
      });

      await message.save();
      await message.populate('sender', 'firstName lastName avatar');

      // Update conversation last message
      await conversation.updateLastMessage(content, socket.userId, type);
      
      // Increment unread count for other participants
      await conversation.incrementUnread(socket.userId);

      // Emit message to all participants in the conversation
      io.to(`conversation_${conversationId}`).emit('new_message', {
        message: message,
        conversationId: conversationId
      });

      // Send notification to offline participants
      const otherParticipants = conversation.participants.filter(
        p => p.user.toString() !== socket.userId
      );

      for (const participant of otherParticipants) {
        const participantUserId = participant.user.toString();
        const isOnline = activeUsers.has(participantUserId);
        
        if (!isOnline) {
          // Send push notification or email notification
          socket.to(`user_${participantUserId}`).emit('message_notification', {
            conversationId,
            message: {
              content: content.substring(0, 100),
              sender: socket.user.firstName + ' ' + socket.user.lastName,
              type
            }
          });
        }
      }

      logger.info(`Message sent in conversation ${conversationId} by user ${socket.userId}`);
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      user: {
        firstName: socket.user.firstName,
        lastName: socket.user.lastName
      },
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      user: {
        firstName: socket.user.firstName,
        lastName: socket.user.lastName
      },
      isTyping: false
    });
  });

  // Handle message reactions
  socket.on('add_reaction', async (data) => {
    try {
      const { messageId, emoji } = data;
      const Message = require('./models/Message');
      
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      await message.addReaction(socket.userId, emoji);
      
      // Emit reaction to conversation participants
      io.to(`conversation_${message.conversation}`).emit('message_reaction', {
        messageId,
        userId: socket.userId,
        emoji,
        reactionCounts: message.reactionCounts
      });
    } catch (error) {
      logger.error('Error adding reaction:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  });

  // Handle message editing
  socket.on('edit_message', async (data) => {
    try {
      const { messageId, newContent } = data;
      const Message = require('./models/Message');
      
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (message.sender.toString() !== socket.userId) {
        socket.emit('error', { message: 'Not authorized to edit this message' });
        return;
      }

      await message.editContent(newContent);
      
      // Emit edited message to conversation participants
      io.to(`conversation_${message.conversation}`).emit('message_edited', {
        messageId,
        newContent,
        editedAt: message.metadata.editedAt
      });
    } catch (error) {
      logger.error('Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  // Handle message deletion
  socket.on('delete_message', async (data) => {
    try {
      const { messageId } = data;
      const Message = require('./models/Message');
      
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      if (message.sender.toString() !== socket.userId) {
        socket.emit('error', { message: 'Not authorized to delete this message' });
        return;
      }

      await message.softDelete(socket.userId);
      
      // Emit message deletion to conversation participants
      io.to(`conversation_${message.conversation}`).emit('message_deleted', {
        messageId,
        deletedAt: message.deletedAt
      });
    } catch (error) {
      logger.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  // Handle order/payment updates
  socket.on('order_update', async (data) => {
    try {
      const { conversationId, orderId, previousStatus, newStatus, note } = data;
      
      const Message = require('./models/Message');
      const Conversation = require('./models/Conversation');
      
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Create system message for order update
      const message = new Message({
        conversation: conversationId,
        sender: socket.userId,
        content: `Order status updated from ${previousStatus} to ${newStatus}${note ? ': ' + note : ''}`,
        type: 'order_update',
        metadata: {
          orderUpdate: {
            orderId,
            previousStatus,
            newStatus,
            note
          }
        }
      });

      await message.save();
      
      // Emit order update to conversation participants
      io.to(`conversation_${conversationId}`).emit('order_update', {
        message: message,
        conversationId: conversationId
      });
    } catch (error) {
      logger.error('Error sending order update:', error);
      socket.emit('error', { message: 'Failed to send order update' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`User ${socket.userId} disconnected`);
    
    // Remove from active users
    activeUsers.delete(socket.userId);
    
    // Emit user offline status
    socket.broadcast.emit('user_offline', {
      userId: socket.userId,
      user: {
        _id: socket.user._id,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName
      }
    });

    // Leave all conversation rooms
    if (userRooms.has(socket.userId)) {
      const rooms = userRooms.get(socket.userId);
      rooms.forEach(conversationId => {
        socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
          userId: socket.userId,
          user: {
            _id: socket.user._id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName
          }
        });
      });
      userRooms.delete(socket.userId);
    }
  });

  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Make io available globally for use in other modules
global.io = io;

server.listen(PORT, () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  logger.info(`Socket.IO server initialized`);
});

process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = server;
