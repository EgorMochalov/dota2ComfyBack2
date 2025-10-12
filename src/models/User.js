// models/User.js
const { DataTypes } = require('sequelize');


module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 30]
      }
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    avatar_url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    avatar_data: {
      type: DataTypes.TEXT, // Для хранения Base64
      allowNull: true
    },
    avatar_mimetype: {
      type: DataTypes.STRING,
      allowNull: true
    },
    region: {
      type: DataTypes.ENUM(
        'eu_west', 'eu_east', 'us_west', 'us_east', 
        'russia', 'cis', 'sea', 'china', 'south_america', 'oceania'
      ),
      allowNull: false
    },
    game_modes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    mmr_rating: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 10000
      }
    },
    preferred_roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    about_me: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    is_searching: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    team_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'teams',
        key: 'id'
      }
    },
    last_online: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    search_status_updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        fields: ['region']
      },
      {
        fields: ['mmr_rating']
      },
      {
        fields: ['is_searching']
      },
      {
        fields: ['last_online']
      },
      {
        fields: ['team_id']
      },
      {
        using: 'GIN',
        fields: ['game_modes']
      },
      {
        using: 'GIN',
        fields: ['tags']
      },
      {
        using: 'GIN',
        fields: ['preferred_roles']
      }
    ]
  });

  User.associate = function(models) {
    User.belongsTo(models.Team, { foreignKey: 'team_id', as: 'team' });
    User.hasMany(models.Team, { foreignKey: 'captain_id', as: 'captain_teams' });
    User.hasMany(models.TeamApplication, { foreignKey: 'user_id', as: 'applications' });
    User.hasMany(models.Invitation, { foreignKey: 'invited_user_id', as: 'invitations' });
    User.hasMany(models.Invitation, { foreignKey: 'inviter_id', as: 'sent_invitations' });
    User.hasMany(models.ChatMessage, { foreignKey: 'user_id', as: 'messages' });
    User.hasMany(models.ChatRoomMember, { foreignKey: 'user_id', as: 'chat_memberships' });
    User.hasMany(models.UserBlock, { foreignKey: 'blocker_user_id', as: 'blocked_users' });
    User.hasMany(models.UserBlock, { foreignKey: 'blocked_user_id', as: 'blocked_by' });
    User.hasMany(models.Notification, { foreignKey: 'user_id', as: 'notifications' });
  };

  return User;
};