const s3Service = require('../services/s3Service');
const { uploadSingle, uploadMultiple, validateUploadedFiles, processUploadedFiles } = require('../middleware/upload');
const logger = require('../config/logger');

class FileUploadController {
  /**
   * Upload single file to S3
   * @route POST /api/upload/single
   */
  async uploadSingleFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { folder = 'uploads' } = req.body;
      
      const result = await s3Service.uploadFile(
        req.file.buffer,
        req.file.originalname,
        folder,
        req.file.mimetype
      );

      logger.info(`File uploaded successfully: ${result.url}`);

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: result
      });

    } catch (error) {
      logger.error('Single file upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Upload multiple files to S3
   * @route POST /api/upload/multiple
   */
  async uploadMultipleFiles(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      const { folder = 'uploads' } = req.body;
      
      const files = req.files.map(file => ({
        buffer: file.buffer,
        name: file.originalname,
        mimeType: file.mimetype
      }));

      const result = await s3Service.uploadMultipleFiles(files, folder);

      logger.info(`Uploaded ${result.count} files successfully`);

      res.status(200).json({
        success: true,
        message: `${result.count} files uploaded successfully`,
        data: result
      });

    } catch (error) {
      logger.error('Multiple files upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Upload avatar image
   * @route POST /api/upload/avatar
   */
  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No avatar image uploaded'
        });
      }

      // Validate that it's an image
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: 'Avatar must be an image file'
        });
      }

      const result = await s3Service.uploadFile(
        req.file.buffer,
        req.file.originalname,
        'avatars',
        req.file.mimetype
      );

      logger.info(`Avatar uploaded successfully: ${result.url}`);

      res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatarUrl: result.url,
          key: result.key
        }
      });

    } catch (error) {
      logger.error('Avatar upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Upload item images
   * @route POST /api/upload/item-images
   */
  async uploadItemImages(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No images uploaded'
        });
      }

      const { itemId } = req.params;
      const folder = `items/${itemId}`;

      const files = req.files.map(file => ({
        buffer: file.buffer,
        name: file.originalname,
        mimeType: file.mimetype
      }));

      const result = await s3Service.uploadMultipleFiles(files, folder);

      logger.info(`Uploaded ${result.count} item images for item ${itemId}`);

      res.status(200).json({
        success: true,
        message: `${result.count} images uploaded successfully`,
        data: {
          itemId,
          images: result.files,
          count: result.count
        }
      });

    } catch (error) {
      logger.error('Item images upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete file from S3
   * @route DELETE /api/upload/:key
   */
  async deleteFile(req, res) {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'File key is required'
        });
      }

      const result = await s3Service.deleteFile(key);

      logger.info(`File deleted successfully: ${key}`);

      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
        data: result
      });

    } catch (error) {
      logger.error('File deletion error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate presigned URL for direct upload
   * @route POST /api/upload/presigned-url
   */
  async generatePresignedUrl(req, res) {
    try {
      const { fileName, folder = 'uploads', mimeType = 'image/jpeg', expiresIn = 300 } = req.body;

      if (!fileName) {
        return res.status(400).json({
          success: false,
          error: 'File name is required'
        });
      }

      const result = await s3Service.generatePresignedUrl(fileName, folder, mimeType, expiresIn);

      res.status(200).json({
        success: true,
        message: 'Presigned URL generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Presigned URL generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get file metadata
   * @route GET /api/upload/metadata/:key
   */
  async getFileMetadata(req, res) {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'File key is required'
        });
      }

      const result = await s3Service.getFileMetadata(key);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('File metadata error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List files in a folder
   * @route GET /api/upload/list/:folder?
   */
  async listFiles(req, res) {
    try {
      const { folder = '' } = req.params;
      const { maxKeys = 1000 } = req.query;

      const result = await s3Service.listFiles(folder, parseInt(maxKeys));

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('List files error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate presigned URL for avatar upload
   * @route POST /api/upload/presigned-url/avatar
   */
  async generateAvatarPresignedUrl(req, res) {
    try {
      const { fileName, mimeType = 'image/jpeg' } = req.body;
      const userId = req.user.id;

      if (!fileName) {
        return res.status(400).json({
          success: false,
          error: 'File name is required'
        });
      }

      const result = await s3Service.generateAvatarPresignedUrl(fileName, userId, mimeType);

      res.status(200).json({
        success: true,
        message: 'Avatar presigned URL generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Avatar presigned URL generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate presigned URL for item image upload
   * @route POST /api/upload/presigned-url/item-image
   */
  async generateItemImagePresignedUrl(req, res) {
    try {
      const { fileName, itemId, mimeType = 'image/jpeg' } = req.body;

      if (!fileName || !itemId) {
        return res.status(400).json({
          success: false,
          error: 'File name and item ID are required'
        });
      }

      const result = await s3Service.generateItemImagePresignedUrl(fileName, itemId, mimeType);

      res.status(200).json({
        success: true,
        message: 'Item image presigned URL generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Item image presigned URL generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new FileUploadController();
