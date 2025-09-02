const { DataTypes } = require("sequelize");
const sequelize = require("../utils/pool");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    githubToken: {
      type: DataTypes.STRING,
    },
    azureAccessToken: {
      type: DataTypes.STRING,
    },
    defaultAzureOrganization: {
      type: DataTypes.STRING,
    },
    gitlabToken: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "users",
    timestamps: true,
  }
);

module.exports = User;
