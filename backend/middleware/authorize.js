const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No user found.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

const requireAdmin = authorize('admin', 'super_admin');

const requireSuperAdmin = authorize('super_admin');

const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No user found.'
      });
    }

    // Super admin can access everything
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Admin can access most things
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied. You can only access your own resources.'
    });
  };
};

const canManageUser = (targetUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No user found.'
      });
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    if (req.user.role === 'admin') {
      const targetUserId = req.params[targetUserIdField] || req.body[targetUserIdField];
      
      if (targetUserId) {
        return next(); // Simplified for now
      }
    }

    const targetUserId = req.params[targetUserIdField] || req.body[targetUserIdField];
    
    if (targetUserId && targetUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied. Insufficient permissions to manage this user.'
    });
  };
};

module.exports = {
  authorize,
  requireAdmin,
  requireSuperAdmin,
  requireOwnershipOrAdmin,
  canManageUser
};
