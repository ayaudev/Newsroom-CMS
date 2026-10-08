const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, admin } = require('../middleware/auth');

const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  registerAdmin
} = require('../controllers/authController');

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().isLength({max:50}).withMessage('Укажите имя'),
  body('email').isString().bail().trim().isEmail().withMessage('Укажите корректную электронную почту'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать минимум 6 символов')
];

const loginValidation = [
  body('email').isEmail().withMessage('Укажите корректную электронную почту'),
  body('password').isString().bail().notEmpty().withMessage('Укажите пароль')
];

// Routes
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.post('/register-admin', protect, admin, registerValidation, validate, registerAdmin);

module.exports = router;
