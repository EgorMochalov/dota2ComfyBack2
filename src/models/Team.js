// models/Team.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Team = sequelize.define('Team', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [2, 50]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
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
    captain_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
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
    mmr_range_min: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 10000
      }
    },
    mmr_range_max: {
      type: DataTypes.INTEGER,
      defaultValue: 10000,
      validate: {
        min: 0,
        max: 10000
      }
    },
    required_roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    is_searching: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    looking_for_scrim: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    search_status_updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'teams',
    timestamps: true,
    indexes: [
      {
        fields: ['region']
      },
      {
        fields: ['captain_id']
      },
      {
        fields: ['is_searching']
      },
      {
        fields: ['looking_for_scrim']
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
        fields: ['required_roles']
      }
    ]
  });

  Team.associate = function(models) {
    Team.belongsTo(models.User, { foreignKey: 'captain_id', as: 'captain' });
    Team.hasMany(models.User, { foreignKey: 'team_id', as: 'members' });
    Team.hasMany(models.TeamApplication, { foreignKey: 'team_id', as: 'applications' });
    Team.hasMany(models.Invitation, { foreignKey: 'team_id', as: 'invitations' });
    Team.hasOne(models.ChatRoom, { 
      foreignKey: 'team_id', 
      as: 'team_chat',
      scope: {
        type: 'team'
      }
    });
  };

  return Team;
};