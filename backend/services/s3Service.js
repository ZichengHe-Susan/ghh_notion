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
}

module.exports = new S3Service();
