const Address = require('../models/Address');
const User = require('../models/User');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

const addressController = {
  /**
   * @route   GET /api/addresses
   * @desc    Get all addresses for the authenticated user
   * @access  Private
   */
  getAddresses: async (req, res) => {
    try {
      const userId = req.user.id;
      const { type } = req.query;

      const addresses = await Address.getUserAddresses(userId, { type });

      res.json({
        success: true,
        data: addresses,
        count: addresses.length
      });

    } catch (error) {
      logger.error('Get addresses error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch addresses'
      });
    }
  },

  /**
   * @route   GET /api/addresses/default
   * @desc    Get default address for the authenticated user
   * @access  Private
   */
  getDefaultAddress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { type = 'shipping' } = req.query;

      const address = await Address.getDefaultAddress(userId, type);

      if (!address) {
        return res.status(404).json({
          success: false,
          message: `No default ${type} address found`
        });
      }

      res.json({
        success: true,
        data: address
      });

    } catch (error) {
      logger.error('Get default address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch default address'
      });
    }
  },

  /**
   * @route   GET /api/addresses/:id
   * @desc    Get a specific address by ID
   * @access  Private
   */
  getAddressById: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const address = await Address.findOne({ 
        _id: id, 
        user: userId, 
        isActive: true 
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      res.json({
        success: true,
        data: address
      });

    } catch (error) {
      logger.error('Get address by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch address'
      });
    }
  },

  /**
   * @route   POST /api/addresses
   * @desc    Create a new address
   * @access  Private
   */
  createAddress: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user.id;
      const addressData = {
        ...req.body,
        user: userId
      };

      // If this is set as default, handle the default logic
      if (addressData.isDefault) {
        await Address.updateMany(
          { user: userId, type: addressData.type, isDefault: true },
          { isDefault: false }
        );
      }

      const address = new Address(addressData);
      await address.save();

      // Add address to user's address book
      const user = await User.findById(userId);
      await user.addAddress(address._id);

      // If this is a default address, update user's default addresses
      if (address.isDefault) {
        await user.setDefaultAddress(address._id, address.type);
      }

      res.status(201).json({
        success: true,
        data: address,
        message: 'Address created successfully'
      });

    } catch (error) {
      logger.error('Create address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create address'
      });
    }
  },

  /**
   * @route   PUT /api/addresses/:id
   * @desc    Update an address
   * @access  Private
   */
  updateAddress: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const address = await Address.findOne({ 
        _id: id, 
        user: userId, 
        isActive: true 
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      // If setting as default, remove default from other addresses of same type
      if (updateData.isDefault && updateData.isDefault !== address.isDefault) {
        await Address.updateMany(
          { 
            user: userId, 
            type: address.type, 
            _id: { $ne: id }, 
            isDefault: true 
          },
          { isDefault: false }
        );
      }

      // Update the address
      Object.assign(address, updateData);
      await address.save();

      // Update user's default addresses if needed
      const user = await User.findById(userId);
      if (address.isDefault) {
        await user.setDefaultAddress(address._id, address.type);
      }

      res.json({
        success: true,
        data: address,
        message: 'Address updated successfully'
      });

    } catch (error) {
      logger.error('Update address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update address'
      });
    }
  },

  /**
   * @route   DELETE /api/addresses/:id
   * @desc    Delete an address (soft delete)
   * @access  Private
   */
  deleteAddress: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const address = await Address.findOne({ 
        _id: id, 
        user: userId, 
        isActive: true 
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      // Soft delete the address
      address.isActive = false;
      await address.save();

      // Remove from user's address book
      const user = await User.findById(userId);
      await user.removeAddress(address._id);

      res.json({
        success: true,
        message: 'Address deleted successfully'
      });

    } catch (error) {
      logger.error('Delete address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete address'
      });
    }
  },

  /**
   * @route   PUT /api/addresses/:id/set-default
   * @desc    Set an address as default for its type
   * @access  Private
   */
  setDefaultAddress: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const address = await Address.findOne({ 
        _id: id, 
        user: userId, 
        isActive: true 
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      // Remove default status from other addresses of the same type
      await Address.updateMany(
        { 
          user: userId, 
          type: address.type, 
          _id: { $ne: id }, 
          isDefault: true 
        },
        { isDefault: false }
      );

      // Set this address as default
      address.isDefault = true;
      await address.save();

      // Update user's default addresses
      const user = await User.findById(userId);
      await user.setDefaultAddress(address._id, address.type);

      res.json({
        success: true,
        data: address,
        message: 'Address set as default successfully'
      });

    } catch (error) {
      logger.error('Set default address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set default address'
      });
    }
  },

  /**
   * @route   PUT /api/addresses/:id/mark-used
   * @desc    Mark an address as used (for tracking)
   * @access  Private
   */
  markAddressAsUsed: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const address = await Address.findOne({ 
        _id: id, 
        user: userId, 
        isActive: true 
      });

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      await address.markAsUsed();

      res.json({
        success: true,
        data: address,
        message: 'Address marked as used'
      });

    } catch (error) {
      logger.error('Mark address as used error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark address as used'
      });
    }
  }
};

module.exports = addressController;
