const devConfig = {
  smtp: {
    host: process.env.DEV_SMTP_HOST,
    port: process.env.DEV_SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.DEV_SMTP_USER,
      pass: process.env.DEV_SMTP_PASSWORD,
    },
  },
};

const prodConfig = {
  smtp: {
    host: process.env.PROD_SMTP_HOST,
    port: process.env.PROD_SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.PROD_SMTP_USER,
      pass: process.env.PROD_SMTP_PASSWORD,
    },
  },
  from: process.env.PROD_SMTP_SENDER_EMAIL,
};

module.exports = process.env.NODE_ENV === 'production' ? prodConfig : devConfig;
