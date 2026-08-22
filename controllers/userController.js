const multer = require('multer');
const sharp = require('sharp');
const User = require('./../models/userModel');
const ActivityLog = require('./../models/activityLogModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   }
// });
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  // Log activity
  await ActivityLog.logActivity({
    user: req.user.id,
    action: 'photo_upload',
    description: 'User uploaded a new profile photo',
    req
  });

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    'name',
    'email',
    'phone',
    'dateOfBirth',
    'bio',
    'address',
    'preferences'
  );
  if (req.file) filteredBody.photo = req.file.filename;

  // Handle nested address object
  if (req.body.address && typeof req.body.address === 'object') {
    filteredBody.address = filterObj(
      req.body.address,
      'street',
      'city',
      'state',
      'zipCode',
      'country'
    );
  }

  // Handle nested preferences object
  if (req.body.preferences && typeof req.body.preferences === 'object') {
    filteredBody.preferences = filterObj(
      req.body.preferences,
      'newsletter',
      'language',
      'currency'
    );
  }

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  // Log activity
  await ActivityLog.logActivity({
    user: req.user.id,
    action: 'profile_update',
    description: 'User updated their profile',
    metadata: { updatedFields: Object.keys(filteredBody) },
    req
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  // Log activity
  await ActivityLog.logActivity({
    user: req.user.id,
    action: 'account_deactivate',
    description: 'User deactivated their account',
    req
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead'
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// Do NOT update passwords with this!
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

// Get user stats (admin)
exports.getUserStats = catchAsync(async (req, res, next) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ active: true });

  const roleStats = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const authProviderStats = await User.aggregate([
    {
      $group: {
        _id: '$authProvider',
        count: { $sum: 1 }
      }
    }
  ]);

  const newUsersThisMonth = await User.countDocuments({
    createdAt: {
      $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      roleStats,
      authProviderStats
    }
  });
});
