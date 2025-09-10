const multer = require('multer');
const config = require('../config/config');
const logger = require('../config/logger');

// Configure multer for memory storage (we'll upload directly to S3)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Check if file type is allowed
  if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${config.ALLOWED_FILE_TYPES.join(', ')}`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE, // 5MB default
    files: 10 // Maximum 10 files per request
  },
  fileFilter: fileFilter
});

// Middleware for single file upload
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        logger.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName = 'files', maxCount = 10) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        logger.error('Multiple file upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      next();
    });
  };
};

// Middleware for mixed file uploads (different field names)
const uploadFields = (fields) => {
  return (req, res, next) => {
    upload.fields(fields)(req, res, (err) => {
      if (err) {
        logger.error('Fields upload error:', err);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      next();
    });
  };
};

// Validation middleware for uploaded files
const validateUploadedFiles = (req, res, next) => {
  if (!req.file && (!req.files || req.files.length === 0)) {
    return res.status(400).json({
      success: false,
      error: 'No files uploaded'
    });
  }

  // Validate single file
  if (req.file) {
    if (req.file.size > config.MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds maximum allowed size of ${config.MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
  }

  // Validate multiple files
  if (req.files && req.files.length > 0) {
    for (let file of req.files) {
      if (file.size > config.MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          error: `File ${file.originalname} size exceeds maximum allowed size of ${config.MAX_FILE_SIZE / 1024 / 1024}MB`
        });
      }
    }
  }

  next();
};

// Middleware to process uploaded files for S3
const processUploadedFiles = (req, res, next) => {
  try {
    // Process single file
    if (req.file) {
      req.file.buffer = req.file.buffer;
      req.file.name = req.file.originalname;
      req.file.mimeType = req.file.mimetype;
    }

    // Process multiple files
    if (req.files && req.files.length > 0) {
      req.files = req.files.map(file => ({
        buffer: file.buffer,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      }));
    }

    next();
  } catch (error) {
    logger.error('File processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process uploaded files'
    });
  }
};

// Utility function to get file extension
const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

// Utility function to generate unique filename
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = getFileExtension(originalName);
  return `${timestamp}-${randomString}.${extension}`;
};

// Utility function to validate image dimensions (optional)
const validateImageDimensions = (buffer, maxWidth = 2048, maxHeight = 2048) => {
  return new Promise((resolve, reject) => {
    // This would require sharp or similar library for image processing
    // For now, we'll just resolve as valid
    resolve(true);
  });
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  validateUploadedFiles,
  processUploadedFiles,
  getFileExtension,
  generateUniqueFilename,
  validateImageDimensions
};
