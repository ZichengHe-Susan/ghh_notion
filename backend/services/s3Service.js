const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config/config');
const logger = require('../config/logger');

// Configure AWS SDK v3
const s3Client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

class S3Service {
  constructor() {
    this.bucketName = config.AWS_S3_BUCKET_NAME;
    this.bucketUrl = config.AWS_S3_BUCKET_URL;
  }

  /**
   * Upload file to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - Original file name
   * @param {string} folder - Folder path in S3 (e.g., 'avatars', 'items')
   * @param {string} mimeType - File MIME type
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadFile(fileBuffer, fileName, folder = 'uploads', mimeType = 'image/jpeg') {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `${timestamp}-${randomString}.${fileExtension}`;
      
      const key = `${folder}/${uniqueFileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        // ACL: 'public-read', // bucket doesn't allow ACLs
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString()
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await s3Client.send(command);
      
      const fileUrl = `${this.bucketUrl}/${key}`;
      logger.info(`File uploaded to S3: ${fileUrl}`);
      
      return {
        success: true,
        url: fileUrl,
        key: key,
        bucket: this.bucketName,
        originalName: fileName,
        size: fileBuffer.length
      };

    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Upload multiple files to S3
   * @param {Array} files - Array of file objects with buffer, name, mimeType
   * @param {string} folder - Folder path in S3
   * @returns {Promise<Array>} Array of upload results
   */
  async uploadMultipleFiles(files, folder = 'uploads') {
    try {
      const uploadPromises = files.map(file => 
        this.uploadFile(file.buffer, file.name || file.originalname || 'unknown', folder, file.mimeType)
      );

      const results = await Promise.all(uploadPromises);
      
      logger.info(`Uploaded ${results.length} files to S3`);
      
      return {
        success: true,
        files: results,
        count: results.length
      };

    } catch (error) {
      logger.error('S3 multiple upload error:', error);
      throw new Error(`Failed to upload files to S3: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(key) {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: key
      };

      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);
      
      logger.info(`File deleted from S3: ${key}`);
      
      return {
        success: true,
        message: 'File deleted successfully'
      };

    } catch (error) {
      logger.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from S3
   * @param {Array} keys - Array of S3 object keys
   * @returns {Promise<Object>} Delete result
   */
  async deleteMultipleFiles(keys) {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const command = new DeleteObjectsCommand(deleteParams);
      const result = await s3Client.send(command);
      
      logger.info(`Deleted ${result.Deleted.length} files from S3`);
      
      return {
        success: true,
        deleted: result.Deleted,
        errors: result.Errors || []
      };

    } catch (error) {
      logger.error('S3 multiple delete error:', error);
      throw new Error(`Failed to delete files from S3: ${error.message}`);
    }
  }

  /**
   * Get file metadata from S3
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(key) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      const command = new HeadObjectCommand(params);
      const result = await s3Client.send(command);
      
      return {
        success: true,
        metadata: {
          size: result.ContentLength,
          lastModified: result.LastModified,
          contentType: result.ContentType,
          metadata: result.Metadata
        }
      };

    } catch (error) {
      logger.error('S3 metadata error:', error);
      throw new Error(`Failed to get file metadata from S3: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for direct upload
   * @param {string} fileName - Original file name
   * @param {string} folder - Folder path in S3
   * @param {string} mimeType - File MIME type
   * @param {number} expiresIn - URL expiration time in seconds (default: 300)
   * @returns {Promise<Object>} Presigned URL and fields
   */
  async generatePresignedUrl(fileName, folder = 'uploads', mimeType = 'image/jpeg', expiresIn = 300) {
    try {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `${timestamp}-${randomString}.${fileExtension}`;
      
      const key = `${folder}/${uniqueFileName}`;

      const params = {
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType
        // ACL: 'public-read' 
      };

      const command = new PutObjectCommand(params);
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      return {
        success: true,
        presignedUrl,
        key,
        fields: {
          key,
          'Content-Type': mimeType
          // 'x-amz-acl': 'public-read' 
        }
      };

    } catch (error) {
      logger.error('S3 presigned URL error:', error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for file access
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
   * @returns {Promise<Object>} Presigned URL
   */
  async generateAccessUrl(key, expiresIn = 3600) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      const command = new GetObjectCommand(params);
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      return {
        success: true,
        url: presignedUrl,
        expiresIn
      };

    } catch (error) {
      logger.error('S3 access URL error:', error);
      throw new Error(`Failed to generate access URL: ${error.message}`);
    }
  }

  /**
   * List files in a folder
   * @param {string} folder - Folder path in S3
   * @param {number} maxKeys - Maximum number of keys to return
   * @returns {Promise<Object>} List of files
   */
  async listFiles(folder = '', maxKeys = 1000) {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: folder,
        MaxKeys: maxKeys
      };

      const command = new ListObjectsV2Command(params);
      const result = await s3Client.send(command);
      
      return {
        success: true,
        files: result.Contents.map(file => ({
          key: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
          url: `${this.bucketUrl}/${file.Key}`
        })),
        count: result.Contents.length
      };

    } catch (error) {
      logger.error('S3 list files error:', error);
      throw new Error(`Failed to list files from S3: ${error.message}`);
    }
  }

  /**
   * Upload avatar image
   * @param {Buffer} fileBuffer
   * @param {string} fileName - Original file name
   * @param {string} userId - User ID for folder organization
   * @param {string} mimeType - File MIME type
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadAvatar(fileBuffer, fileName, userId, mimeType = 'image/jpeg') {
    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        throw new Error(`Invalid file type for avatar. Allowed types: ${allowedTypes.join(', ')}`);
      }

      const maxSize = 2 * 1024 * 1024; // 2MB
      if (fileBuffer.length > maxSize) {
        throw new Error('Avatar file size cannot exceed 2MB');
      }

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `avatar-${timestamp}-${randomString}.${fileExtension}`;
      
      const key = `avatars/${userId}/${uniqueFileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
          type: 'avatar',
          userId: userId
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await s3Client.send(command);
      
      const fileUrl = `${this.bucketUrl}/${key}`;
      logger.info(`Avatar uploaded to S3: ${fileUrl}`);
      
      return {
        success: true,
        url: fileUrl,
        key: key,
        bucket: this.bucketName,
        originalName: fileName,
        size: fileBuffer.length,
        type: 'avatar'
      };

    } catch (error) {
      logger.error('S3 avatar upload error:', error);
      throw new Error(`Failed to upload avatar to S3: ${error.message}`);
    }
  }

  /**
   * Upload item image with specific validation
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - Original file name
   * @param {string} itemId - Item ID for folder organization
   * @param {string} mimeType - File MIME type
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadItemImage(fileBuffer, fileName, itemId, mimeType = 'image/jpeg') {
    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        throw new Error(`Invalid file type for item image. Allowed types: ${allowedTypes.join(', ')}`);
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (fileBuffer.length > maxSize) {
        throw new Error('Item image file size cannot exceed 5MB');
      }

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `item-${timestamp}-${randomString}.${fileExtension}`;
      
      const key = `items/${itemId}/${uniqueFileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
          type: 'item-image',
          itemId: itemId
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await s3Client.send(command);
      
      const fileUrl = `${this.bucketUrl}/${key}`;
      logger.info(`Item image uploaded to S3: ${fileUrl}`);
      
      return {
        success: true,
        url: fileUrl,
        key: key,
        bucket: this.bucketName,
        originalName: fileName,
        size: fileBuffer.length,
        type: 'item-image'
      };

    } catch (error) {
      logger.error('S3 item image upload error:', error);
      throw new Error(`Failed to upload item image to S3: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for avatar upload
   * @param {string} fileName - Original file name
   * @param {string} userId - User ID
   * @param {string} mimeType - File MIME type
   * @param {number} expiresIn - URL expiration time in seconds (default: 300)
   * @returns {Promise<Object>} Presigned URL and fields
   */
  async generateAvatarPresignedUrl(fileName, userId, mimeType = 'image/jpeg', expiresIn = 300) {
    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        throw new Error(`Invalid file type for avatar. Allowed types: ${allowedTypes.join(', ')}`);
      }

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `avatar-${timestamp}-${randomString}.${fileExtension}`;
      
      const key = `avatars/${userId}/${uniqueFileName}`;

      const params = {
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType,
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
          type: 'avatar',
          userId: userId
        }
      };

      const command = new PutObjectCommand(params);
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      return {
        success: true,
        presignedUrl,
        key,
        fields: {
          key,
          'Content-Type': mimeType
        }
      };

    } catch (error) {
      logger.error('S3 avatar presigned URL error:', error);
      throw new Error(`Failed to generate avatar presigned URL: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for item image upload
   * @param {string} fileName - Original file name
   * @param {string} itemId - Item ID
   * @param {string} mimeType - File MIME type
   * @param {number} expiresIn - URL expiration time in seconds (default: 300)
   * @returns {Promise<Object>} Presigned URL and fields
   */
  async generateItemImagePresignedUrl(fileName, itemId, mimeType = 'image/jpeg', expiresIn = 300) {
    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        throw new Error(`Invalid file type for item image. Allowed types: ${allowedTypes.join(', ')}`);
      }

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `item-${timestamp}-${randomString}.${fileExtension}`;
      
      const key = `items/${itemId}/${uniqueFileName}`;

      const params = {
        Bucket: this.bucketName,
        Key: key,
        ContentType: mimeType,
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
          type: 'item-image',
          itemId: itemId
        }
      };

      const command = new PutObjectCommand(params);
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      return {
        success: true,
        presignedUrl,
        key,
        fields: {
          key,
          'Content-Type': mimeType
        }
      };

    } catch (error) {
      logger.error('S3 item image presigned URL error:', error);
      throw new Error(`Failed to generate item image presigned URL: ${error.message}`);
    }
  }

  /**
   * Delete all files in a folder (for cleanup)
   * @param {string} folder - Folder path in S3
   * @returns {Promise<Object>} Delete result
   */
  async deleteFolder(folder) {
    try {
      const listResult = await this.listFiles(folder);
      
      if (listResult.files.length === 0) {
        return {
          success: true,
          message: 'No files found in folder',
          deleted: []
        };
      }

      const keys = listResult.files.map(file => file.key);
      const deleteResult = await this.deleteMultipleFiles(keys);
      
      logger.info(`Deleted folder ${folder} with ${deleteResult.deleted.length} files`);
      
      return {
        success: true,
        message: `Deleted folder ${folder}`,
        deleted: deleteResult.deleted,
        errors: deleteResult.errors
      };

    } catch (error) {
      logger.error('S3 delete folder error:', error);
      throw new Error(`Failed to delete folder from S3: ${error.message}`);
    }
  }

  /**
   * Get file size and type information
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} File information
   */
  async getFileInfo(key) {
    try {
      const metadata = await this.getFileMetadata(key);
      
      return {
        success: true,
        info: {
          key,
          size: metadata.metadata.size,
          contentType: metadata.metadata.contentType,
          lastModified: metadata.metadata.lastModified,
          url: `${this.bucketUrl}/${key}`
        }
      };

    } catch (error) {
      logger.error('S3 get file info error:', error);
      throw new Error(`Failed to get file info from S3: ${error.message}`);
    }
  }
}

module.exports = new S3Service();
