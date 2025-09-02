const { Sequelize } = require("sequelize");
const dbConfig = require("../../config/db.config.js");

const sequelize = new Sequelize(
  dbConfig.development.database,
  dbConfig.development.username,
  dbConfig.development.password,
  
  {
    host: dbConfig.development.host,
    port: dbConfig.development.port, 
    dialect: dbConfig.development.dialect,
    pool: dbConfig.development.pool,
    logging: false,

    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

module.exports = sequelize;
