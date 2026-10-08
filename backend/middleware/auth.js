const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const tokenFrom = req => /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '')?.[1];
const unauthorized = res => res.status(401).json({ success: false, message: 'Войдите в аккаунт для доступа' });

async function authenticate(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  if (!claims || typeof claims !== 'object' || !Number.isFinite(claims.exp) ||
      typeof claims.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.id)) return null;
  if (await RevokedToken.isRevoked(token)) return null;
  const user = await User.findById(claims.id);
  if (!user) return null;
  req.auth = { token, expiresAt: claims.exp };
  return user;
}
const tokenError = error => ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name);

exports.protect = async (req, res, next) => {
  try {
    req.user = await authenticate(req);
    if (!req.user) return unauthorized(res);
    next();
  } catch (error) {
    if (tokenError(error)) return unauthorized(res);
    next(error);
  }
};

exports.admin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Доступ разрешён только администратору' });
  next();
};

exports.optionalAuth = async (req, res, next) => {
  try { req.user = await authenticate(req); next(); }
  catch (error) {
    if (tokenError(error)) { req.user = null; return next(); }
    next(error);
  }
};
