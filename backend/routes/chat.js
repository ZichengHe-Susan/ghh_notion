const express = require('express');
const router = express.Router();

// Import controllers (to be created)
const {
  getConversations,
  getConversation,
  createConversation,
  sendMessage,
  getMessages,
  markAsRead,
  deleteConversation
} = require('../controllers/chatController');

// Import middleware
const auth = require('../middleware/auth');

// @route   GET /api/chat/conversations
// @desc    Get user's conversations
// @access  Private
router.get('/conversations', auth, getConversations);

// @route   GET /api/chat/conversations/:id
// @desc    Get single conversation
// @access  Private
router.get('/conversations/:id', auth, getConversation);

// @route   POST /api/chat/conversations
// @desc    Create new conversation
// @access  Private
router.post('/conversations', auth, createConversation);

// @route   GET /api/chat/conversations/:id/messages
// @desc    Get conversation messages
// @access  Private
router.get('/conversations/:id/messages', auth, getMessages);

// @route   POST /api/chat/conversations/:id/messages
// @desc    Send message
// @access  Private
router.post('/conversations/:id/messages', auth, sendMessage);

// @route   PUT /api/chat/conversations/:id/read
// @desc    Mark conversation as read
// @access  Private
router.put('/conversations/:id/read', auth, markAsRead);

// @route   DELETE /api/chat/conversations/:id
// @desc    Delete conversation
// @access  Private
router.delete('/conversations/:id', auth, deleteConversation);

module.exports = router;
