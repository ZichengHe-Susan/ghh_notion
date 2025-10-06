const Item = require('../models/Item');
const Category = require('../models/Category');
const User = require('../models/User');
const s3Service = require('../services/s3Service');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

const itemController = {
  /**
   * @route   GET /api/items
   * @desc    Get all items with pagination and filtering
   * @access  Public
   */
  getItems: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        minPrice,
        maxPrice,
        location,
        condition,
        status = 'active',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = {};

      if (status === 'active') {
        filter.status = 'active';
        filter['availability.status'] = 'available';
        filter['availability.quantity'] = { $gt: 0 };
        filter.expiresAt = { $gt: new Date() };
      } else {
        filter.status = status;
      }

      if (category) {
        filter.category = category;
      }

      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
      }

      if (location) {
        // Note: Location filtering would require population of address data
        // For now, we'll skip location filtering or implement it differently
        // filter['location.address.address.city'] = new RegExp(location, 'i');
      }

      if (condition) {
        filter.condition = condition;
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const items = await Item.find(filter)
        .populate('category', 'name slug')
        .populate('seller', 'firstName lastName email')
        .populate('location.address', 'address contactInfo label')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalItems = await Item.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / parseInt(limit));

      res.json({
        success: true,
        data: {
          items,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      logger.error('Get items error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch items'
      });
    }
  },

  /**
   * @route   GET /api/items/:id
   * @desc    Get single item by ID with order information if sold
   * @access  Public
   */
  getItem: async (req, res) => {
    try {
      const { id } = req.params;

      const item = await Item.findById(id)
        .populate('category', 'name slug description')
        .populate('seller', 'firstName lastName email phone')
        .populate('location.address', 'address contactInfo label')
        .lean();

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      // Get order information if item is sold
      let orderInfo = null;
      if (item.availability?.status === 'sold' || item.status === 'sold' || item.availability?.quantity === 0) {
        const Order = require('../models/Order');
        const order = await Order.findOne({
          'items.item': id,
          seller: item.seller._id
        })
        .populate('buyer', 'firstName lastName email phone')
        .populate('shipping.address', 'address contactInfo label')
        .lean();

        if (order) {
          orderInfo = {
            orderId: order._id,
            orderNumber: order.orderNumber,
            buyer: order.buyer,
            status: order.status,
            shipping: order.shipping,
            createdAt: order.createdAt,
            payment: order.payment,
            escrow: order.escrow
          };
        }
      }

      // Add order information to item
      const itemWithOrderInfo = {
        ...item,
        orderInfo
      };

      await Item.findByIdAndUpdate(id, { $inc: { 'analytics.views': 1 } });

      res.json({
        success: true,
        data: itemWithOrderInfo
      });

    } catch (error) {
      logger.error('Get item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch item'
      });
    }
  },

  /**
   * @route   POST /api/items
   * @desc    Create new item
   * @access  Private
   */
  createItem: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      // Check if user has a complete Stripe Connect account
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const canSell = user.stripeConnectAccount.accountId && 
                     user.stripeConnectAccount.chargesEnabled && 
                     user.stripeConnectAccount.payoutsEnabled &&
                     user.stripeConnectAccount.detailsSubmitted;

      if (!canSell) {
        return res.status(400).json({
          success: false,
          error: 'Stripe Connect account required',
          message: 'You must complete Stripe Connect onboarding before listing items for sale',
          stripeConnectRequired: true,
          accountStatus: user.stripeConnectAccount.onboardingStatus,
          requirements: user.stripeConnectAccount.requirements
        });
      }

      const itemData = {
        ...req.body,
        seller: req.user.id
      };

      const category = await Category.findById(itemData.category);
      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category'
        });
      }

      const item = new Item(itemData);
      await item.save();

      const populatedItem = await Item.findById(item._id)
        .populate('category', 'name slug')
        .populate('seller', 'firstName lastName email')
        .populate('location.address', 'address contactInfo label');

      res.status(201).json({
        success: true,
        data: populatedItem,
        message: 'Item created successfully'
      });

    } catch (error) {
      logger.error('Create item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create item'
      });
    }
  },

  /**
   * @route   PUT /api/items/:id
   * @desc    Update item
   * @access  Private
   */
  updateItem: async (req, res) => {
    try {
      const { id } = req.params;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const item = await Item.findById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      if (item.seller.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this item'
        });
      }

      const updatedItem = await Item.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      ).populate('category', 'name slug')
       .populate('seller', 'firstName lastName email');

      res.json({
        success: true,
        data: updatedItem,
        message: 'Item updated successfully'
      });

    } catch (error) {
      logger.error('Update item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update item'
      });
    }
  },

  /**
   * @route   DELETE /api/items/:id
   * @desc    Delete item
   * @access  Private
   */
  deleteItem: async (req, res) => {
    try {
      const { id } = req.params;

      const item = await Item.findById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      if (item.seller.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this item'
        });
      }

      if (item.images && item.images.length > 0) {
        const imageKeys = item.images.map(img => {
          const urlParts = img.url.split('/');
          return urlParts.slice(-2).join('/'); 
        });

        try {
          await s3Service.deleteMultipleFiles(imageKeys);
        } catch (s3Error) {
          logger.error('Failed to delete images from S3:', s3Error);
        }
      }

      await Item.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Item deleted successfully'
      });

    } catch (error) {
      logger.error('Delete item error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete item'
      });
    }
  },

  /**
   * @route   GET /api/items/search
   * @desc    Search items with advanced filtering
   * @access  Public
   */
  searchItems: async (req, res) => {
    try {
      const {
        q: query,
        category,
        minPrice,
        maxPrice,
        location,
        condition,
        page = 1,
        limit = 20,
        sortBy = 'relevance'
      } = req.query;

      const filters = {};

      if (category) {
        filters.category = category;
      }

      if (minPrice || maxPrice) {
        filters.minPrice = minPrice ? parseFloat(minPrice) : undefined;
        filters.maxPrice = maxPrice ? parseFloat(maxPrice) : undefined;
      }

      if (location) {
        filters.location = location;
      }

      if (condition) {
        filters.condition = condition;
      }

      const searchQuery = {
        status: 'active',
        'availability.status': 'available',
        'availability.quantity': { $gt: 0 },
        expiresAt: { $gt: new Date() }
      };

      if (query) {
        searchQuery.$or = [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } }
        ];
      }

      if (filters.category) {
        searchQuery.category = filters.category;
      }
      
      if (filters.minPrice || filters.maxPrice) {
        searchQuery.price = {};
        if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
        if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
      }
      
      if (filters.location) {
        searchQuery['location.city'] = new RegExp(filters.location, 'i');
      }
      
      if (filters.condition) {
        searchQuery.condition = filters.condition;
      }

      const totalResults = await Item.countDocuments(searchQuery);

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const paginatedResults = Item.find(searchQuery)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('category', 'name slug')
        .populate('seller', 'firstName lastName')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: {
          items: await paginatedResults.exec(),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalResults / parseInt(limit)),
            totalResults,
            query: query || '',
            filters
          }
        }
      });

    } catch (error) {
      logger.error('Search items error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search items'
      });
    }
  },

  /**
   * @route   GET /api/items/categories
   * @desc    Get item categories
   * @access  Public
   */
  getItemCategories: async (req, res) => {
    try {
      const { includeInactive = false } = req.query;

      let categories;
      if (includeInactive === 'true') {
        categories = await Category.find().sort({ sortOrder: 1, name: 1 });
      } else {
        categories = await Category.findActive();
      }

      res.json({
        success: true,
        data: categories
      });

    } catch (error) {
      logger.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch categories'
      });
    }
  },

  /**
   * @route   POST /api/items/:id/images
   * @desc    Upload item images
   * @access  Private
   */
  uploadItemImages: async (req, res) => {
    try {
      const { id } = req.params;

      const item = await Item.findById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      if (item.seller.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to upload images for this item'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No images uploaded'
        });
      }

      const uploadResults = await s3Service.uploadMultipleFiles(req.files, 'items');

      if (!uploadResults.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to upload images'
        });
      }

      const newImages = uploadResults.files.map((file, index) => ({
        url: file.url,
        alt: req.body.alts && req.body.alts[index] ? req.body.alts[index] : '',
        isPrimary: req.body.primaryIndex === index.toString(),
        uploadedAt: new Date()
      }));

      item.images.push(...newImages);

      if (item.images.length === newImages.length || req.body.primaryIndex !== undefined) {
        item.images.forEach((img, index) => {
          img.isPrimary = index === parseInt(req.body.primaryIndex) || 
                         (item.images.length === newImages.length && index === 0);
        });
      }

      await item.save();

      res.json({
        success: true,
        data: {
          item: await Item.findById(id).populate('category', 'name slug'),
          uploadedImages: uploadResults.files
        },
        message: 'Images uploaded successfully'
      });

    } catch (error) {
      logger.error('Upload item images error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload images'
      });
    }
  },

  /**
   * @route   DELETE /api/items/:id/images/:imageId
   * @desc    Delete specific item image
   * @access  Private
   */
  deleteItemImage: async (req, res) => {
    try {
      const { id, imageId } = req.params;

      const item = await Item.findById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      if (item.seller.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete images for this item'
        });
      }

      const imageIndex = item.images.findIndex(img => img._id.toString() === imageId);
      if (imageIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Image not found'
        });
      }

      const imageToDelete = item.images[imageIndex];

      try {
        const urlParts = imageToDelete.url.split('/');
        const key = urlParts.slice(-2).join('/');
        await s3Service.deleteFile(key);
      } catch (s3Error) {
        logger.error('Failed to delete image from S3:', s3Error);
      }

      item.images.splice(imageIndex, 1);

      if (imageToDelete.isPrimary && item.images.length > 0) {
        item.images[0].isPrimary = true;
      }

      await item.save();

      res.json({
        success: true,
        message: 'Image deleted successfully'
      });

    } catch (error) {
      logger.error('Delete item image error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete image'
      });
    }
  },

  /**
   * @route   GET /api/items/seller/:sellerId
   * @desc    Get items by seller with order information
   * @access  Public
   */
  getItemsBySeller: async (req, res) => {
    try {
      const { sellerId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      const filter = { seller: sellerId };
      if (status) {
        filter.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const items = await Item.find(filter)
        .populate('category', 'name slug')
        .sort({ 
          // Sort sold items first, then by creation date
          'availability.status': -1, // 'sold' comes before 'available' alphabetically
          createdAt: -1 
        })
        .skip(skip)
        .limit(parseInt(limit));

      // Get order information for sold items
      const Order = require('../models/Order');
      const soldItemIds = items
        .filter(item => item.availability.status === 'sold' || item.status === 'sold')
        .map(item => item._id);

      let orderInfo = {};
      if (soldItemIds.length > 0) {
        const orders = await Order.find({
          'items.item': { $in: soldItemIds },
          seller: sellerId
        })
        .populate('buyer', 'firstName lastName email')
        .populate('items.item', 'title')
        .lean();

        // Create a map of item ID to order information
        orders.forEach(order => {
          order.items.forEach(orderItem => {
            if (soldItemIds.includes(orderItem.item._id)) {
              orderInfo[orderItem.item._id] = {
                orderId: order._id,
                orderNumber: order.orderNumber,
                buyer: order.buyer,
                status: order.status,
                shipping: order.shipping,
                createdAt: order.createdAt,
                payment: order.payment
              };
            }
          });
        });
      }

      // Add order information to items
      const itemsWithOrderInfo = items.map(item => {
        const itemObj = item.toObject();
        if (orderInfo[item._id]) {
          itemObj.orderInfo = orderInfo[item._id];
        }
        return itemObj;
      });

      const totalItems = await Item.countDocuments(filter);

      res.json({
        success: true,
        data: {
          items: itemsWithOrderInfo,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalItems / parseInt(limit)),
            totalItems
          }
        }
      });

    } catch (error) {
      logger.error('Get items by seller error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch seller items'
      });
    }
  }
};

module.exports = itemController;
