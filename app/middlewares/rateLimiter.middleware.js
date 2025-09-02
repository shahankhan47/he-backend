const rateLimit = require("express-rate-limit");

function calculateMilliseconds(windowMs, unit = "minutes") {
  const unitMultipliers = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 3600 * 1000,
  };

  return windowMs * unitMultipliers[unit];
}

function formatRemainingTime(remainingTimeMs) {
  if (remainingTimeMs < 60000) {
    const seconds = Math.ceil(remainingTimeMs / 1000);
    return `${seconds} second${seconds > 1 ? "s" : ""}`;
  } else if (remainingTimeMs < 3600000) {
    const minutes = Math.ceil(remainingTimeMs / 60000);
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    const hours = Math.ceil(remainingTimeMs / 3600000);
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
}

function generateErrorMessage(remaining, resetTime) {
  const currentTime = Date.now();
  const remainingTimeMs = resetTime.getTime() - currentTime;
  const formattedTime = formatRemainingTime(remainingTimeMs);

  return `Too many requests. Please try again in ${formattedTime}.`;
}

const createRateLimiter = (options = {}) => {
  const { windowMs = 1, max = 1, windowMsUnit = "minutes" } = options;
  const calculatedWindowMs = calculateMilliseconds(windowMs, windowMsUnit);

  const rateLimitOptions = {
    windowMs: calculatedWindowMs,
    max: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      const errorMessage = generateErrorMessage(
        req.rateLimit.remaining,
        req.rateLimit.resetTime
      );
      res.status(429).json({
        message: errorMessage,
      });
    },
    ...options,
  };

  return rateLimit(rateLimitOptions);
};

const rateLimiters = {
  strict: createRateLimiter({
    windowMs: 1,
    windowMsUnit: "hours",
    max: 5,
  }),

  medium: createRateLimiter({
    windowMs: 15,
    windowMsUnit: "minutes",
    max: 100,
  }),

  light: createRateLimiter({
    windowMs: 1,
    windowMsUnit: "minutes",
    max: 30,
  }),
};

module.exports = {
  createRateLimiter,
  rateLimiters,
};
