const express = require('express');
const router = express.Router();

// Import controllers
const fileUploadController = require('../controllers/fileUploadController');

// Import middleware
const { auth } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, validateUploadedFiles, processUploadedFiles } = require('../middleware/upload');

// @route   POST /api/upload/single
// @desc    Upload single file
// @access  Private
router.post('/single', 
  auth, 
  uploadSingle('file'), 
  validateUploadedFiles, 
  processUploadedFiles, 
  fileUploadController.uploadSingleFile
);

// @route   POST /api/upload/multiple
// @desc    Upload multiple files
// @access  Private
router.post('/multiple', 
  auth, 
  uploadMultiple('files', 10), 
  validateUploadedFiles, 
  processUploadedFiles, 
  fileUploadController.uploadMultipleFiles
);

// @route   POST /api/upload/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', 
  auth, 
  uploadSingle('avatar'), 
  validateUploadedFiles, 
  processUploadedFiles, 
  fileUploadController.uploadAvatar
);

// @route   POST /api/upload/item-images/:itemId
// @desc    Upload item images
// @access  Private
router.post('/item-images/:itemId', 
  auth, 
  uploadMultiple('images', 10), 
  validateUploadedFiles, 
  processUploadedFiles, 
  fileUploadController.uploadItemImages
);

// @route   POST /api/upload/presigned-url
// @desc    Generate presigned URL for direct upload
// @access  Private
router.post('/presigned-url', auth, fileUploadController.generatePresignedUrl);

// @route   POST /api/upload/presigned-url/avatar
// @desc    Generate presigned URL for avatar upload
// @access  Private
router.post('/presigned-url/avatar', auth, fileUploadController.generateAvatarPresignedUrl);

// @route   POST /api/upload/presigned-url/item-image
// @desc    Generate presigned URL for item image upload
// @access  Private
router.post('/presigned-url/item-image', auth, fileUploadController.generateItemImagePresignedUrl);

// @route   DELETE /api/upload/:key
// @desc    Delete file from S3
// @access  Private
router.delete('/:key', auth, fileUploadController.deleteFile);

// @route   GET /api/upload/metadata/:key
// @desc    Get file metadata
// @access  Private
router.get('/metadata/:key', auth, fileUploadController.getFileMetadata);

// @route   GET /api/upload/list/:folder?
// @desc    List files in a folder
// @access  Private
router.get('/list/:folder?', auth, fileUploadController.listFiles);

module.exports = router;