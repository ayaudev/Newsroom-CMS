const multer = require('multer');
const path = require('path');

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /^(\.jpe?g|\.png|\.gif|\.webp)$/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    const error = new Error('Допустимы изображения JPEG, PNG, GIF и WebP');
    error.status = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;
