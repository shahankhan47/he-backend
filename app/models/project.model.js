const { DataTypes } = require('sequelize');
const sequelize = require('../utils/pool');

const Project = sequelize.define(
  'Project',
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    projectName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'manual',
    },
    latestCommitHash: {
      type: DataTypes.STRING,
    },
    latestCommitMessage: {
      type: DataTypes.STRING,
    },
    branchName: {
      type: DataTypes.STRING,
    },
    webhookId: {
      type: DataTypes.STRING,
    },
    webhookSecret: {
      type: DataTypes.STRING,
    },
    repositoryUrl: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: 'projects',
    timestamps: true,
  }
);

module.exports = Project;
