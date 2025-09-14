const mongoose = require('mongoose');
const { User, Category, Item, Order, Payment, Conversation, Message, Review, AdminLog, Notification } = require('../models');

class DatabaseUtils {

  static async getDatabaseStats() {
    try {
      const stats = {
        users: await User.countDocuments(),
        categories: await Category.countDocuments(),
        items: await Item.countDocuments(),
        orders: await Order.countDocuments(),
        payments: await Payment.countDocuments(),
        conversations: await Conversation.countDocuments(),
        messages: await Message.countDocuments(),
        reviews: await Review.countDocuments(),
        adminLogs: await AdminLog.countDocuments(),
        notifications: await Notification.countDocuments()
      };

      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }


  static async getCollectionSizes() {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      const sizes = {};

      for (const collection of collections) {
        const stats = await db.collection(collection.name).stats();
        sizes[collection.name] = {
          count: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          totalIndexSize: stats.totalIndexSize
        };
      }

      return sizes;
    } catch (error) {
      console.error('Error getting collection sizes:', error);
      throw error;
    }
  }


  static async getIndexInfo() {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      const indexInfo = {};

      for (const collection of collections) {
        const indexes = await db.collection(collection.name).listIndexes().toArray();
        indexInfo[collection.name] = indexes.map(index => ({
          name: index.name,
          key: index.key,
          unique: index.unique || false,
          sparse: index.sparse || false,
          background: index.background || false,
          partialFilterExpression: index.partialFilterExpression || null
        }));
      }

      return indexInfo;
    } catch (error) {
      console.error('Error getting index info:', error);
      throw error;
    }
  }


  static async checkDatabaseHealth() {
    try {
      const health = {
        connection: mongoose.connection.readyState === 1,
        collections: {},
        indexes: {},
        performance: {}
      };

      const collections = ['users', 'categories', 'items', 'orders', 'payments', 'conversations', 'messages', 'reviews', 'adminlogs', 'notifications'];
      
      for (const collectionName of collections) {
        try {
          const count = await mongoose.connection.db.collection(collectionName).countDocuments();
          health.collections[collectionName] = {
            exists: true,
            count: count,
            healthy: true
          };
        } catch (error) {
          health.collections[collectionName] = {
            exists: false,
            error: error.message,
            healthy: false
          };
        }
      }

      const criticalIndexes = {
        users: ['email', 'role'],
        items: ['title', 'category', 'seller'],
        orders: ['orderNumber', 'buyer', 'seller'],
        payments: ['paymentIntentId', 'order']
      };

      for (const [collectionName, indexFields] of Object.entries(criticalIndexes)) {
        try {
          const indexes = await mongoose.connection.db.collection(collectionName).listIndexes().toArray();
          const indexNames = indexes.map(idx => idx.name);
          
          health.indexes[collectionName] = {
            exists: true,
            indexes: indexNames,
            criticalIndexesPresent: indexFields.every(field => 
              indexNames.some(name => name.includes(field))
            )
          };
        } catch (error) {
          health.indexes[collectionName] = {
            exists: false,
            error: error.message
          };
        }
      }

      return health;
    } catch (error) {
      console.error('Error checking database health:', error);
      throw error;
    }
  }

  static async optimizeDatabase() {
    try {
      console.log('🔧 Optimizing database...');
      
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      for (const collection of collections) {
        console.log(`Rebuilding indexes for ${collection.name}...`);
        await mongoose.connection.db.collection(collection.name).reIndex();
      }

      for (const collection of collections) {
        console.log(`Compacting ${collection.name}...`);
        await mongoose.connection.db.command({ compact: collection.name });
      }

      console.log('Database optimization completed');
      return { success: true, message: 'Database optimized successfully' };
    } catch (error) {
      console.error('Error optimizing database:', error);
      throw error;
    }
  }


  static async backupCollections(collections = null) {
    try {
      const db = mongoose.connection.db;
      const collectionsToBackup = collections || await db.listCollections().toArray();
      const backup = {};

      for (const collection of collectionsToBackup) {
        const collectionName = collection.name;
        console.log(`Backing up ${collectionName}...`);
        
        const documents = await db.collection(collectionName).find({}).toArray();
        backup[collectionName] = {
          count: documents.length,
          data: documents,
          backedUpAt: new Date()
        };
      }

      return backup;
    } catch (error) {
      console.error('Error backing up collections:', error);
      throw error;
    }
  }



  static async restoreCollections(backup) {
    try {
      const db = mongoose.connection.db;
      
      for (const [collectionName, backupData] of Object.entries(backup)) {
        console.log(`Restoring ${collectionName}...`);
        
        await db.collection(collectionName).deleteMany({});
        
        if (backupData.data && backupData.data.length > 0) {
          await db.collection(collectionName).insertMany(backupData.data);
        }
        
        console.log(`Restored ${backupData.count} documents to ${collectionName}`);
      }

      return { success: true, message: 'Collections restored successfully' };
    } catch (error) {
      console.error('Error restoring collections:', error);
      throw error;
    }
  }


  static async cleanupExpiredData() {
    try {
      console.log('🧹 Cleaning up expired data...');
      
      const cleanupResults = {};

      const expiredNotifications = await Notification.find({
        expiresAt: { $lte: new Date() },
        isArchived: false
      });
      
      if (expiredNotifications.length > 0) {
        await Notification.updateMany(
          { expiresAt: { $lte: new Date() }, isArchived: false },
          { $set: { isArchived: true, archivedAt: new Date() } }
        );
        cleanupResults.notifications = expiredNotifications.length;
      }

      const oldAdminLogs = await AdminLog.find({
        retentionDate: { $lte: new Date() },
        isArchived: false
      });
      
      if (oldAdminLogs.length > 0) {
        await AdminLog.updateMany(
          { retentionDate: { $lte: new Date() }, isArchived: false },
          { $set: { isArchived: true, archivedAt: new Date() } }
        );
        cleanupResults.adminLogs = oldAdminLogs.length;
      }

      const expiredItems = await Item.find({
        expiresAt: { $lte: new Date() },
        status: 'active'
      });
      
      if (expiredItems.length > 0) {
        await Item.updateMany(
          { expiresAt: { $lte: new Date() }, status: 'active' },
          { $set: { status: 'expired' } }
        );
        cleanupResults.items = expiredItems.length;
      }

      console.log('Cleanup completed:', cleanupResults);
      return cleanupResults;
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
      throw error;
    }
  }


  static async getPerformanceMetrics() {
    try {
      const db = mongoose.connection.db;
      const serverStatus = await db.command({ serverStatus: 1 });
      
      return {
        connections: serverStatus.connections,
        operations: serverStatus.opcounters,
        memory: serverStatus.mem,
        network: serverStatus.network,
        uptime: serverStatus.uptime,
        version: serverStatus.version
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }
}

module.exports = DatabaseUtils;
