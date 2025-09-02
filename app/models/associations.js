const User = require('./user.model');
const Project = require('./project.model');

User.hasMany(Project, {
  foreignKey: 'createdBy',
  as: 'projects',
});

Project.belongsTo(User, {
  foreignKey: 'createdBy',
});

module.exports = {
  User,
  Project,
};
