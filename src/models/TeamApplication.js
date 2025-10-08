// models/TeamApplication.js
module.exports = (sequelize, DataTypes) => {
  const TeamApplication = sequelize.define('TeamApplication', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { 
      type: DataTypes.ENUM('pending', 'accepted', 'rejected'), 
      defaultValue: 'pending' 
    },
    message: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'team_applications',
    timestamps: true
  });

  TeamApplication.associate = function(models) {
    TeamApplication.belongsTo(models.Team, { foreignKey: 'team_id' });
    TeamApplication.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return TeamApplication;
};