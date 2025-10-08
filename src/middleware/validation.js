// middleware/validation.js
const Joi = require('joi');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property]);
    
    if (error) {
      const errorMessage = error.details[0].message.replace(/['"]/g, '');
      return res.status(400).json({ 
        error: errorMessage 
      });
    }
    
    next();
  };
};

// Схемы валидации
const authSchemas = {
  register: Joi.object({
    email: Joi.string().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    username: Joi.string().min(3).max(30).required().messages({
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
    region: Joi.string().valid(
      'eu_west', 'eu_east', 'us_west', 'us_east', 
      'russia', 'cis', 'sea', 'china', 'south_america', 'oceania'
    ).required().messages({
      'any.only': 'Please select a valid region',
      'any.required': 'Region is required'
    })
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

const userSchemas = {
  updateProfile: Joi.object({
    username: Joi.string().min(3).max(30),
    region: Joi.string().valid(
      'eu_west', 'eu_east', 'us_west', 'us_east', 
      'russia', 'cis', 'sea', 'china', 'south_america', 'oceania'
    ),
    game_modes: Joi.array().items(Joi.string().valid(
      'all_pick', 'ranked', 'turbo', 'captains_mode', 
      'ability_draft', 'all_random', 'custom'
    )),
    mmr_rating: Joi.number().min(0).max(10000),
    preferred_roles: Joi.array().items(Joi.string().valid(
      'carry', 'mid', 'offlane', 'support', 'hard_support'
    )),
    about_me: Joi.string().max(1000).allow('', null),
    tags: Joi.array().items(Joi.string().max(50)),
    is_searching: Joi.boolean(),
  }),

  search: Joi.object({
    region: Joi.string().valid(
      'eu_west', 'eu_east', 'us_west', 'us_east', 
      'russia', 'cis', 'sea', 'china', 'south_america', 'oceania'
    ),
    game_modes: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ),
    mmr_min: Joi.number().min(0).max(10000),
    mmr_max: Joi.number().min(0).max(10000),
    is_online: Joi.boolean(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    is_searching: Joi.boolean(),
        preferred_roles: Joi.array().items(Joi.string().valid(
      'carry', 'mid', 'offlane', 'support', 'hard_support'
    )),
  })
};

const teamSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(1000).allow('', null),
    region: Joi.string().valid(
      'eu_west', 'eu_east', 'us_west', 'us_east', 
      'russia', 'cis', 'sea', 'china', 'south_america', 'oceania'
    ).required(),
    game_modes: Joi.array().items(Joi.string().valid(
      'all_pick', 'ranked', 'turbo', 'captains_mode', 
      'ability_draft', 'all_random', 'custom'
    )).min(1).required(),
    mmr_range_min: Joi.number().min(0).max(10000).required(),
    mmr_range_max: Joi.number().min(Joi.ref('mmr_range_min')).max(10000).required(),
    required_roles: Joi.array().items(Joi.string().valid(
      'carry', 'mid', 'offlane', 'support', 'hard_support'
    )).min(1).required(),
    tags: Joi.array().items(Joi.string().max(50)),
    is_searching: Joi.boolean(),
    looking_for_scrim: Joi.boolean()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(50),
    description: Joi.string().max(1000).allow('', null),
    region: Joi.string().valid(
      'eu_west', 'eu_east', 'us_west', 'us_east', 
      'russia', 'cis', 'sea', 'china', 'south_america', 'oceania'
    ),
    game_modes: Joi.array().items(Joi.string().valid(
      'all_pick', 'ranked', 'turbo', 'captains_mode', 
      'ability_draft', 'all_random', 'custom'
    )).min(1),
    mmr_range_min: Joi.number().min(0).max(10000),
    mmr_range_max: Joi.number().min(0).max(10000),
    required_roles: Joi.array().items(Joi.string().valid(
      'carry', 'mid', 'offlane', 'support', 'hard_support'
    )),
    tags: Joi.array().items(Joi.string().max(50)),
    is_searching: Joi.boolean(),
    looking_for_scrim: Joi.boolean()
  })
};

module.exports = {
  validate,
  authSchemas,
  userSchemas,
  teamSchemas
};