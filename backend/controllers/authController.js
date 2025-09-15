const User = require('../models/User');
const { generateTokenPair, hashToken, generateEmailVerificationToken, generatePasswordResetToken } = require('../utils/jwt');
const emailService = require('../services/emailService');
const { validationResult } = require('express-validator');

const authController = {
  register: async (req, res) => {
    try {
      console.log('Registration request body:', req.body);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { firstName, lastName, email, password } = req.body;

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User already exists with this email'
        });
      }

      const user = new User({
        firstName,
        lastName,
        email,
        password,
        role: 'user'
      });

      const verificationToken = generateEmailVerificationToken();
      user.emailVerificationToken = hashToken(verificationToken);

      await user.save();

      try {
        await emailService.sendVerificationEmail(user, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      const tokens = generateTokenPair(user);

      user.refreshTokens.push({
        token: hashToken(tokens.refreshToken),
        createdAt: new Date()
      });
      await user.save();

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
          }
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  },

  login: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { email, password } = req.body;

      const user = await User.findByEmail(email).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Account is deactivated'
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      user.lastLogin = new Date();
      await user.save();

      const tokens = generateTokenPair(user);

      user.refreshTokens.push({
        token: hashToken(tokens.refreshToken),
        createdAt: new Date()
      });
      await user.save();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            lastLogin: user.lastLogin
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  },

  logout: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        const hashedToken = hashToken(refreshToken);
        await User.findOneAndUpdate(
          { 'refreshTokens.token': hashedToken },
          { $pull: { refreshTokens: { token: hashedToken } } }
        );
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  },

  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      const { verifyRefreshToken } = require('../utils/jwt');
      const decoded = verifyRefreshToken(refreshToken);

      const hashedToken = hashToken(refreshToken);
      const user = await User.findOne({
        _id: decoded.id,
        'refreshTokens.token': hashedToken
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      const tokens = generateTokenPair(user);

      await User.findOneAndUpdate(
        { _id: user._id, 'refreshTokens.token': hashedToken },
        { $set: { 'refreshTokens.$.token': hashToken(tokens.refreshToken) } }
      );

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        return res.json({
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        });
      }

      const resetToken = generatePasswordResetToken();
      user.passwordResetToken = hashToken(resetToken);
      user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      try {
        await emailService.sendPasswordResetEmail(user, resetToken);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        return res.status(500).json({
          success: false,
          error: 'Failed to send password reset email'
        });
      }

      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Password reset request failed'
      });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { token, password } = req.body;

      const hashedToken = hashToken(token);
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successful'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Password reset failed'
      });
    }
  },

  verifyEmail: async (req, res) => {
    try {
      const { token } = req.params;

      const hashedToken = hashToken(token);
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        isEmailVerified: false
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification token'
        });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      await user.save();

      try {
        await emailService.sendWelcomeEmail(user);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Email verification failed'
      });
    }
  },

  resendVerification: async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          error: 'Email already verified'
        });
      }

      const verificationToken = generateEmailVerificationToken();
      user.emailVerificationToken = hashToken(verificationToken);
      await user.save();

      try {
        await emailService.sendVerificationEmail(user, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return res.status(500).json({
          success: false,
          error: 'Failed to send verification email'
        });
      }

      res.json({
        success: true,
        message: 'Verification email sent'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification email'
      });
    }
  },

  getProfile: async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          user: {
            id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            email: req.user.email,
            role: req.user.role,
            isEmailVerified: req.user.isEmailVerified,
            avatar: req.user.avatar,
            profile: req.user.profile,
            stats: req.user.stats,
            createdAt: req.user.createdAt,
            lastLogin: req.user.lastLogin
          }
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  }
};

module.exports = authController;
