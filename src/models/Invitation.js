// models/Invitation.js
module.exports = (sequelize, DataTypes) => {
  const Invitation = sequelize.define('Invitation', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    status: { 
      type: DataTypes.ENUM('pending', 'accepted', 'rejected'), 
      defaultValue: 'pending' 
    },
    message: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'invitations',
    timestamps: true
  });

  Invitation.associate = function(models) {
    Invitation.belongsTo(models.Team, { foreignKey: 'team_id' });
    Invitation.belongsTo(models.User, { foreignKey: 'invited_user_id', as: 'invited_user' });
    Invitation.belongsTo(models.User, { foreignKey: 'inviter_id', as: 'inviter' });
  };

  return Invitation;
};