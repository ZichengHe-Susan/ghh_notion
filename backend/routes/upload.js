const express = require('express');
const router = express.Router();

// Import controller and middleware
const fileUploadController = require('../controllers/fileUploadController');
const { uploadSingle, uploadMultiple, validateUploadedFiles, processUploadedFiles } = require('../middleware/upload');
const { auth } = require('../middleware/auth');

// @route   POST /api/upload/single
// @desc    Upload single file to S3
// @access  Private
router.post('/single', 
  auth,
  uploadSingle('file'),
  validateUploadedFiles,
  processUploadedFiles,
  fileUploadController.uploadSingleFile
);

// @route   POST /api/upload/multiple
// @desc    Upload multiple files to S3
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
  uploadMultiple('images', 5),
  validateUploadedFiles,
  processUploadedFiles,
  fileUploadController.uploadItemImages
);

// @route   DELETE /api/upload/:key
// @desc    Delete file from S3
// @access  Private
router.delete('/:key',
  auth,
  fileUploadController.deleteFile
);

// @route   POST /api/upload/presigned-url
// @desc    Generate presigned URL for direct upload
// @access  Private
router.post('/presigned-url',
  auth,
  fileUploadController.generatePresignedUrl
);

// @route   GET /api/upload/metadata/:key
// @desc    Get file metadata
// @access  Private
router.get('/metadata/:key',
  auth,
  fileUploadController.getFileMetadata
);

// @route   GET /api/upload/list/:folder?
// @desc    List files in folder
// @access  Private
router.get('/list/:folder?',
  auth,
  fileUploadController.listFiles
);

module.exports = router;
