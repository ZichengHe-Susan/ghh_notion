const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Order = require('../models/Order');
const Item = require('../models/Item');
const logger = require('../config/logger');

const chatController = {
  // Get all conversations for a user
  getConversations: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status = 'active' } = req.query;

      const conversations = await Conversation.findByUser(userId)
        .populate('participants.user', 'firstName lastName avatar email')
        .populate('order', 'status totalAmount')
        .populate('item', 'title price images')
        .populate('lastMessage.sender', 'firstName lastName avatar')
        .sort({ 'lastMessage.timestamp': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Get total count for pagination
      const total = await Conversation.countDocuments({
        'participants.user': userId,
        status: status === 'all' ? { $exists: true } : status
      });

      res.json({
        success: true,
        conversations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } catch (error) {
      logger.error('Error fetching conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversations'
      });
    }
  },

  // Get single conversation with messages
  getConversation: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const conversation = await Conversation.findById(id)
        .populate('participants.user', 'firstName lastName avatar email')
        .populate('order', 'status totalAmount shippingAddress')
        .populate('item', 'title price images description')
        .populate('lastMessage.sender', 'firstName lastName avatar');

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(
        p => p.user._id.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this conversation'
        });
      }

      // Get recent messages
      const messages = await Message.findByConversation(id, 1, 50)
        .populate('sender', 'firstName lastName avatar')
        .populate('replyTo', 'content sender createdAt');

      // Mark conversation as read for this user
      await conversation.updateLastRead(userId);

      res.json({
        success: true,
        conversation,
        messages: messages.reverse() // Reverse to show oldest first
      });
    } catch (error) {
      logger.error('Error fetching conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversation'
      });
    }
  },

  // Create new conversation
  createConversation: async (req, res) => {
    try {
      const { orderId, itemId, subject } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!orderId || !itemId || !subject) {
        return res.status(400).json({
          success: false,
          message: 'Order ID, Item ID, and subject are required'
        });
      }

      // Check if order exists and user is involved
      const order = await Order.findById(orderId)
        .populate('buyer', 'firstName lastName')
        .populate('item', 'title seller');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check if user is buyer or seller
      const isBuyer = order.buyer._id.toString() === userId;
      const isSeller = order.item.seller.toString() === userId;

      if (!isBuyer && !isSeller) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create conversation for this order'
        });
      }

      // Check if conversation already exists
      const existingConversation = await Conversation.findByOrder(orderId);
      if (existingConversation) {
        return res.status(409).json({
          success: false,
          message: 'Conversation already exists for this order',
          conversation: existingConversation
        });
      }

      // Create conversation
      const conversation = new Conversation({
        participants: [
          {
            user: order.buyer._id,
            role: 'buyer'
          },
          {
            user: order.item.seller,
            role: 'seller'
          }
        ],
        order: orderId,
        item: itemId,
        subject: subject
      });

      await conversation.save();

      // Populate the conversation
      await conversation.populate([
        { path: 'participants.user', select: 'firstName lastName avatar email' },
        { path: 'order', select: 'status totalAmount' },
        { path: 'item', select: 'title price images' }
      ]);

      // Emit conversation created event via Socket.IO
      if (global.io) {
        global.io.to(`user_${order.buyer._id}`).emit('conversation_created', {
          conversation: conversation
        });
        global.io.to(`user_${order.item.seller}`).emit('conversation_created', {
          conversation: conversation
        });
      }

      res.status(201).json({
        success: true,
        conversation
      });
    } catch (error) {
      logger.error('Error creating conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create conversation'
      });
    }
  },

  // Send message
  sendMessage: async (req, res) => {
    try {
      const { id } = req.params;
      const { content, type = 'text', replyTo, attachments } = req.body;
      const userId = req.user.id;

      // Validate content
      if (!content && type === 'text') {
        return res.status(400).json({
          success: false,
          message: 'Message content is required'
        });
      }

      // Check if conversation exists
      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(
        p => p.user.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to send messages in this conversation'
        });
      }

      // Create message
      const message = new Message({
        conversation: id,
        sender: userId,
        content,
        type,
        replyTo,
        attachments: attachments || []
      });

      await message.save();
      await message.populate('sender', 'firstName lastName avatar');

      // Update conversation
      await conversation.updateLastMessage(content, userId, type);
      await conversation.incrementUnread(userId);

      // Emit message via Socket.IO
      if (global.io) {
        global.io.to(`conversation_${id}`).emit('new_message', {
          message: message,
          conversationId: id
        });
      }

      res.status(201).json({
        success: true,
        message
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  },

  // Get messages for a conversation
  getMessages: async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      // Check if conversation exists and user is participant
      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const isParticipant = conversation.participants.some(
        p => p.user.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access messages'
        });
      }

      // Get messages
      const messages = await Message.findByConversation(id, parseInt(page), parseInt(limit));

      // Mark messages as read
      await conversation.updateLastRead(userId);

      res.json({
        success: true,
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages'
      });
    }
  },

  // Mark conversation as read
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(
        p => p.user.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to mark this conversation as read'
        });
      }

      await conversation.updateLastRead(userId);

      res.json({
        success: true,
        message: 'Conversation marked as read'
      });
    } catch (error) {
      logger.error('Error marking conversation as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark conversation as read'
      });
    }
  },

  // Delete conversation (archive)
  deleteConversation: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(
        p => p.user.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this conversation'
        });
      }

      // Archive conversation instead of deleting
      await conversation.archive();

      res.json({
        success: true,
        message: 'Conversation archived successfully'
      });
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete conversation'
      });
    }
  },

  // Get unread message count
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user.id;

      const conversations = await Conversation.findUnreadConversations(userId);
      const totalUnread = conversations.reduce((total, conv) => {
        const participant = conv.participants.find(p => p.user.toString() === userId);
        return total + (participant.role === 'buyer' ? conv.unreadCount.buyer : conv.unreadCount.seller);
      }, 0);

      res.json({
        success: true,
        unreadCount: totalUnread,
        conversations: conversations.length
      });
    } catch (error) {
      logger.error('Error fetching unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch unread count'
      });
    }
  },

  // Search conversations
  searchConversations: async (req, res) => {
    try {
      const userId = req.user.id;
      const { query, page = 1, limit = 20 } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const conversations = await Conversation.find({
        'participants.user': userId,
        $or: [
          { subject: { $regex: query, $options: 'i' } },
          { 'lastMessage.content': { $regex: query, $options: 'i' } }
        ]
      })
        .populate('participants.user', 'firstName lastName avatar')
        .populate('order', 'status totalAmount')
        .populate('item', 'title price images')
        .populate('lastMessage.sender', 'firstName lastName avatar')
        .sort({ 'lastMessage.timestamp': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      res.json({
        success: true,
        conversations,
        query
      });
    } catch (error) {
      logger.error('Error searching conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search conversations'
      });
    }
  },

  // Get conversation statistics
  getStats: async (req, res) => {
    try {
      const userId = req.user.id;

      const stats = await Conversation.getConversationStats(userId);
      const messageStats = await Message.getMessageStats(null, userId);

      res.json({
        success: true,
        stats: {
          conversations: stats,
          messages: messageStats
        }
      });
    } catch (error) {
      logger.error('Error fetching conversation stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversation statistics'
      });
    }
  },

  // Upload file for chat
  uploadFile: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      // Check if conversation exists and user is participant
      const conversation = await Conversation.findById(id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const isParticipant = conversation.participants.some(
        p => p.user.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to upload files in this conversation'
        });
      }

      // For now, we'll store files locally or use a simple approach
      // In production, you'd upload to S3 and get URLs
      const attachments = files.map(file => ({
        filename: `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        url: `/uploads/chat/${Date.now()}-${file.originalname}`, // Local path for now
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
      }));

      // Create message with file attachments
      const message = new Message({
        conversation: id,
        sender: userId,
        content: `📎 Shared ${files.length} file${files.length > 1 ? 's' : ''}`,
        type: files.length === 1 && files[0].mimetype.startsWith('image/') ? 'image' : 'file',
        attachments: attachments
      });

      await message.save();
      await message.populate('sender', 'firstName lastName avatar');

      // Update conversation
      await conversation.updateLastMessage(message.content, userId, message.type);
      await conversation.incrementUnread(userId);

      // Emit message via Socket.IO
      if (global.io) {
        global.io.to(`conversation_${id}`).emit('new_message', {
          message: message,
          conversationId: id
        });
      }

      res.status(201).json({
        success: true,
        message,
        attachments
      });
    } catch (error) {
      logger.error('Error uploading file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file'
      });
    }
  }
};

module.exports = chatController;