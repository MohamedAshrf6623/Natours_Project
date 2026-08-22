const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('./../models/userModel');
const ActivityLog = require('./../models/activityLogModel');
const Notification = require('./../models/notificationModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();

  // Create welcome notification
  await Notification.createNotification({
    user: newUser._id,
    type: 'welcome',
    title: 'Welcome to Natours! 🎉',
    message:
      'Thank you for joining Natours! Start exploring amazing tours around the world.',
    link: '/'
  });

  // Log activity
  await ActivityLog.logActivity({
    user: newUser._id,
    action: 'signup',
    description: 'User signed up with email and password',
    req
  });

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select(
    '+password +loginAttempts +lockUntil +twoFactorEnabled +twoFactorSecret'
  );

  if (!user || !(await user.correctPassword(password, user.password))) {
    // Increment login attempts if user exists
    if (user) {
      await user.incrementLoginAttempts();
    }
    return next(new AppError('Incorrect email or password', 401));
  }

  // Check if account is locked
  if (user.isLocked()) {
    return next(
      new AppError(
        'Account is temporarily locked due to too many failed login attempts. Please try again later.',
        423
      )
    );
  }

  // Check if 2FA is enabled
  if (user.twoFactorEnabled) {
    // Generate a temporary token for 2FA verification
    const tempToken = jwt.sign(
      { id: user._id, require2FA: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Please verify your 2FA code',
      require2FA: true,
      tempToken
    });
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  // Log activity
  await ActivityLog.logActivity({
    user: user._id,
    action: 'login',
    description: 'User logged in with email and password',
    req
  });

  // 3) If everything ok, send token to client
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  // Log activity if user is available
  if (req.user) {
    ActivityLog.logActivity({
      user: req.user._id,
      action: 'logout',
      description: 'User logged out',
      req
    }).catch(() => {});
  }

  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // Block 2FA temp tokens from accessing protected routes
  if (decoded.require2FA) {
    return next(
      new AppError('Please complete 2FA verification first.', 401)
    );
  }

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // Skip 2FA temp tokens
      if (decoded.require2FA) {
        return next();
      }

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Log activity
  await ActivityLog.logActivity({
    user: user._id,
    action: 'password_reset',
    description: 'User reset their password via email token',
    req
  });

  // Create notification
  await Notification.createNotification({
    user: user._id,
    type: 'password_changed',
    title: 'Password Reset Successful',
    message:
      'Your password has been successfully reset. If you did not do this, please contact support immediately.'
  });

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // Log activity
  await ActivityLog.logActivity({
    user: user._id,
    action: 'password_change',
    description: 'User changed their password',
    req
  });

  // Create notification
  await Notification.createNotification({
    user: user._id,
    type: 'password_changed',
    title: 'Password Changed',
    message:
      'Your password has been changed successfully. If you did not do this, please reset your password immediately.'
  });

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});

// ==========================================
// OAuth: Google Login Callback Handler
// ==========================================
exports.googleCallback = catchAsync(async (req, res, next) => {
  // Passport attaches the user to req.user after successful Google auth
  if (!req.user) {
    return next(new AppError('Google authentication failed', 401));
  }

  // Log activity
  await ActivityLog.logActivity({
    user: req.user._id,
    action: 'oauth_login',
    description: 'User logged in via Google OAuth',
    metadata: { provider: 'google' },
    req
  });

  // Update last login
  req.user.lastLogin = Date.now();
  await req.user.save({ validateBeforeSave: false });

  // Create and send JWT token
  const token = signToken(req.user._id);

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });

  // Redirect to home page after successful OAuth login
  res.redirect('/');
});

// ==========================================
// Two-Factor Authentication (2FA)
// ==========================================

// Enable 2FA - Generate secret and QR code
exports.enable2FA = catchAsync(async (req, res, next) => {
  const secret = speakeasy.generateSecret({
    name: `Natours (${req.user.email})`,
    issuer: 'Natours'
  });

  // Store secret temporarily (not yet verified)
  await User.findByIdAndUpdate(req.user.id, {
    twoFactorSecret: secret.base32
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Log activity
  await ActivityLog.logActivity({
    user: req.user.id,
    action: '2fa_enable',
    description: 'User initiated 2FA setup',
    req
  });

  res.status(200).json({
    status: 'success',
    data: {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      message:
        'Scan the QR code with your authenticator app, then verify with a code to complete setup.'
    }
  });
});

// Verify and activate 2FA
exports.verify2FA = catchAsync(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new AppError('Please provide a 2FA verification code', 400));
  }

  const user = await User.findById(req.user.id).select('+twoFactorSecret');

  if (!user.twoFactorSecret) {
    return next(new AppError('Please enable 2FA first', 400));
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2
  });

  if (!verified) {
    return next(new AppError('Invalid 2FA code. Please try again.', 400));
  }

  // Activate 2FA
  user.twoFactorEnabled = true;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication has been successfully enabled!'
  });
});

// Validate 2FA during login
exports.validate2FALogin = catchAsync(async (req, res, next) => {
  const { tempToken, token } = req.body;

  if (!tempToken || !token) {
    return next(
      new AppError('Please provide both temporary token and 2FA code', 400)
    );
  }

  // Verify temp token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(tempToken, process.env.JWT_SECRET);
  } catch (err) {
    return next(
      new AppError('2FA verification session expired. Please login again.', 401)
    );
  }

  if (!decoded.require2FA) {
    return next(new AppError('Invalid 2FA verification request', 400));
  }

  const user = await User.findById(decoded.id).select('+twoFactorSecret');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2
  });

  if (!verified) {
    return next(new AppError('Invalid 2FA code', 401));
  }

  // Reset login attempts
  await user.resetLoginAttempts();

  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  // Log activity
  await ActivityLog.logActivity({
    user: user._id,
    action: 'login',
    description: 'User logged in with 2FA verification',
    req
  });

  // Send actual token
  createSendToken(user, 200, req, res);
});

// Disable 2FA
exports.disable2FA = catchAsync(async (req, res, next) => {
  const { password, token } = req.body;

  if (!password) {
    return next(new AppError('Please provide your password to disable 2FA', 400));
  }

  const user = await User.findById(req.user.id).select(
    '+password +twoFactorSecret'
  );

  // Verify password
  if (!(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect password', 401));
  }

  // Verify current 2FA token if provided
  if (token) {
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      return next(new AppError('Invalid 2FA code', 400));
    }
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save({ validateBeforeSave: false });

  // Log activity
  await ActivityLog.logActivity({
    user: user._id,
    action: '2fa_disable',
    description: 'User disabled 2FA',
    req
  });

  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication has been disabled'
  });
});
