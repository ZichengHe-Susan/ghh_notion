const express = require('express');
const router = express.Router();

// Import controllers (placeholder for now)
const chatController = require('../controllers/chatController');

// Import middleware
const { auth } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');

// @route   GET /api/chat/conversations
// @desc    Get user's conversations
// @access  Private
router.get('/conversations', auth, chatController.getConversations);

// @route   GET /api/chat/conversations/:id
// @desc    Get single conversation
// @access  Private
router.get('/conversations/:id', auth, chatController.getConversation);

// @route   POST /api/chat/conversations
// @desc    Create new conversation
// @access  Private
router.post('/conversations', auth, chatController.createConversation);

// @route   GET /api/chat/conversations/:id/messages
// @desc    Get conversation messages
// @access  Private
router.get('/conversations/:id/messages', auth, chatController.getMessages);

// @route   POST /api/chat/conversations/:id/messages
// @desc    Send message
// @access  Private
router.post('/conversations/:id/messages', auth, chatController.sendMessage);

// @route   POST /api/chat/conversations/:id/upload
// @desc    Upload file for chat
// @access  Private
router.post('/conversations/:id/upload', auth, uploadMultiple('files', 5), chatController.uploadFile);

// @route   PUT /api/chat/conversations/:id/read
// @desc    Mark conversation as read
// @access  Private
router.put('/conversations/:id/read', auth, chatController.markAsRead);

// @route   DELETE /api/chat/conversations/:id
// @desc    Delete conversation
// @access  Private
router.delete('/conversations/:id', auth, chatController.deleteConversation);

// @route   GET /api/chat/unread-count
// @desc    Get unread message count
// @access  Private
router.get('/unread-count', auth, chatController.getUnreadCount);

// @route   GET /api/chat/search
// @desc    Search conversations
// @access  Private
router.get('/search', auth, chatController.searchConversations);

// @route   GET /api/chat/stats
// @desc    Get conversation statistics
// @access  Private
router.get('/stats', auth, chatController.getStats);

module.exports = router;
