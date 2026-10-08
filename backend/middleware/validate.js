const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array().map(error => error.msg).join(', '),
      errors: errors.array()
    });
  }
  next();
};

module.exports = validate;
