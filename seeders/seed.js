// seeders/seed.js
const { sequelize, User, Team, ChatRoom, ChatRoomMember, ChatMessage, TeamApplication, Invitation, UserBlock, Notification } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { DataTypes } = require('sequelize');

async function seed() {
  try {
    console.log('Starting database seeding...');

    // Синхронизируем базу данных
    await sequelize.sync({ force: true });
    console.log('Database synced successfully');

    // Создаем тестовых пользователей
    const users = await User.bulkCreate([
      {
        email: 'player1@example.com',
        username: 'CarryPlayer',
        password_hash: await hashPassword('password123'),
        region: 'eu_west',
        game_modes: ['ranked', 'turbo'],
        mmr_rating: 4500,
        preferred_roles: ['carry', 'mid'],
        about_me: 'Professional carry player looking for competitive team',
        tags: ['competitive', 'english', 'tryhard'],
        is_searching: true
      },
      {
        email: 'player2@example.com',
        username: 'SupportMain',
        password_hash: await hashPassword('password123'),
        region: 'eu_west',
        game_modes: ['ranked', 'captains_mode'],
        mmr_rating: 4200,
        preferred_roles: ['support', 'hard_support'],
        about_me: 'Position 4/5 player with good game sense',
        tags: ['friendly', 'english', 'competitive'],
        is_searching: true
      },
      {
        email: 'player3@example.com',
        username: 'MidOrFeed',
        password_hash: await hashPassword('password123'),
        region: 'russia',
        game_modes: ['ranked', 'all_pick'],
        mmr_rating: 5000,
        preferred_roles: ['mid'],
        about_me: 'Mid lane specialist, comfortable with most heroes',
        tags: ['pro', 'russian', 'mid'],
        is_searching: true
      },
      {
        email: 'player4@example.com',
        username: 'OfflaneEnjoyer',
        password_hash: await hashPassword('password123'),
        region: 'eu_east',
        game_modes: ['ranked', 'turbo'],
        mmr_rating: 3800,
        preferred_roles: ['offlane'],
        about_me: 'Offlane player who creates space for the team',
        tags: ['space_creator', 'english'],
        is_searching: true
      },
      {
        email: 'player5@example.com',
        username: 'TeamCaptain',
        password_hash: await hashPassword('password123'),
        region: 'us_west',
        game_modes: ['ranked', 'captains_mode', 'tournament'],
        mmr_rating: 4700,
        preferred_roles: ['carry', 'mid', 'offlane'],
        about_me: 'Experienced team captain looking for dedicated players',
        tags: ['leader', 'english', 'tournaments'],
        is_searching: false
      }
    ]);

    console.log('Created users:', users.length);

    // Создаем команды
    const teams = await Team.bulkCreate([
      {
        name: 'Pro Warriors',
        description: 'Professional team competing in tournaments',
        captain_id: users[0].id,
        region: 'eu_west',
        game_modes: ['ranked', 'captains_mode', 'tournament'],
        mmr_range_min: 4000,
        mmr_range_max: 5500,
        required_roles: ['support', 'offlane'],
        tags: ['pro', 'tournaments', 'competitive'],
        is_searching: true,
        looking_for_scrim: true
      },
      {
        name: 'Casual Gamers',
        description: 'Friendly team playing for fun and improvement',
        captain_id: users[4].id,
        region: 'us_west',
        game_modes: ['ranked', 'turbo', 'all_pick'],
        mmr_range_min: 3000,
        mmr_range_max: 4500,
        required_roles: ['carry', 'support'],
        tags: ['friendly', 'improvement', 'casual'],
        is_searching: true,
        looking_for_scrim: false
      }
    ]);

    console.log('Created teams:', teams.length);

    // Назначаем пользователей в команды
    await users[0].update({ team_id: teams[0].id }); // CarryPlayer в Pro Warriors
    await users[1].update({ team_id: teams[0].id }); // SupportMain в Pro Warriors
    await users[4].update({ team_id: teams[1].id }); // TeamCaptain в Casual Gamers

    // Создаем чатовые комнаты
    const chatRooms = await ChatRoom.bulkCreate([
      {
        type: 'team',
        name: 'Pro Warriors Team Chat',
        team_id: teams[0].id
      },
      {
        type: 'team',
        name: 'Casual Gamers Team Chat',
        team_id: teams[1].id
      },
      {
        type: 'private'
      },
      {
        type: 'private'
      }
    ]);

    console.log('Created chat rooms:', chatRooms.length);

    // Добавляем участников в чаты
    await ChatRoomMember.bulkCreate([
      // Team chat for Pro Warriors
      { room_id: chatRooms[0].id, user_id: users[0].id },
      { room_id: chatRooms[0].id, user_id: users[1].id },
      
      // Team chat for Casual Gamers
      { room_id: chatRooms[1].id, user_id: users[4].id },
      
      // Private chat between Player1 and Player3
      { room_id: chatRooms[2].id, user_id: users[0].id },
      { room_id: chatRooms[2].id, user_id: users[2].id },
      
      // Private chat between Player2 and Player4
      { room_id: chatRooms[3].id, user_id: users[1].id },
      { room_id: chatRooms[3].id, user_id: users[3].id }
    ]);

    console.log('Created chat room members');

    // Создаем тестовые сообщения
    await ChatMessage.bulkCreate([
      {
        room_id: chatRooms[0].id,
        user_id: users[0].id,
        message: 'Привет команда! Готовы к тренировке сегодня?',
        message_type: 'text'
      },
      {
        room_id: chatRooms[0].id,
        user_id: users[1].id,
        message: 'Да, я готов. Во сколько собираемся?',
        message_type: 'text'
      },
      {
        room_id: chatRooms[0].id,
        user_id: users[0].id,
        message: 'Давайте в 20:00 по МСК',
        message_type: 'text'
      },
      {
        room_id: chatRooms[2].id,
        user_id: users[0].id,
        message: 'Привет! Хочешь сыграть вместе?',
        message_type: 'text'
      },
      {
        room_id: chatRooms[2].id,
        user_id: users[2].id,
        message: 'Конечно! Я как раз ищу тиммейтов для ранкеда',
        message_type: 'text'
      }
    ]);

    console.log('Created chat messages');

    // Создаем тестовые заявки в команды
    const applications = await TeamApplication.bulkCreate([
      {
        team_id: teams[0].id,
        user_id: users[2].id,
        message: 'Хочу присоединиться к вашей команде. Играю на миде на 5к MMR',
        status: 'pending'
      },
      {
        team_id: teams[1].id,
        user_id: users[3].id,
        message: 'Ищу команду для регулярной игры',
        status: 'pending'
      }
    ], { returning: true });

    console.log('Created team applications');

    // Создаем тестовые приглашения
    const invitations = await Invitation.bulkCreate([
      {
        team_id: teams[0].id,
        invited_user_id: users[3].id,
        inviter_id: users[0].id,
        message: 'Приглашаем тебя в нашу команду в качестве оффлейнера'
      }
    ], { returning: true });

    console.log('Created invitations');

    // Создаем тестовые блокировки
    await UserBlock.create({
      blocker_user_id: users[0].id,
      blocked_user_id: users[4].id
    });

    console.log('Created user blocks');

    // Создаем тестовые уведомления
    await Notification.bulkCreate([
      {
        user_id: users[0].id,
        type: 'application',
        title: 'New Team Application',
        message: 'MidOrFeed has applied to join your team Pro Warriors',
        related_entity_type: 'application',
        related_entity_id: applications[0].id // Используем реальный UUID заявки
      },
      {
        user_id: users[2].id,
        type: 'invitation',
        title: 'Team Invitation',
        message: 'You have been invited to join team Pro Warriors',
        related_entity_type: 'invitation',
        related_entity_id: invitations[0].id // Используем реальный UUID приглашения
      }
    ]);

    console.log('Created notifications');

    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('📝 Test Data Summary:');
    console.log(`👥 Users: ${users.length} (player1@example.com - player5@example.com, password: password123)`);
    console.log(`🏆 Teams: ${teams.length}`);
    console.log(`💬 Chat Rooms: ${chatRooms.length}`);
    console.log(`📨 Applications: 2`);
    console.log(`📩 Invitations: 1`);
    console.log(`🚫 Blocks: 1`);
    console.log('');
    console.log('🚀 You can now start testing the API!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await sequelize.close();
  }
}

// Запускаем сидирование только если файл вызван напрямую
if (require.main === module) {
  seed();
}

module.exports = seed;