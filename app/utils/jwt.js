const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const createJWT = (userInfo) => {
  const payload = userInfo;

  const token = jwt.sign(payload, JWT_SECRET);

  return token;
};

const verifyJWT = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = { createJWT, verifyJWT };
