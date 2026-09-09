const Joi = require('joi');

/**
 * Express middleware factory — validates req.body against a Joi schema.
 * Returns 400 with field-level error details on failure.
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
    allowUnknown: true,
  });
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      })),
    });
  }
  req.body = value;
  next();
};

// ── Schemas ─────────────────────────────────────────────────────────

const schemas = {};

schemas.register = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().trim().min(1).required(),
  bio: Joi.string().allow(null, ''),
  skills: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null, ''),
  portfolio_links: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null, ''),
  profile_picture_url: Joi.string().uri().allow(null, ''),
});

schemas.login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

schemas.event = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().allow(null, ''),
  event_date: Joi.date().iso().required(),
  location: Joi.string().max(255).allow(null, ''),
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'CLOSED').allow(null),
  organizer_id: Joi.string().uuid().allow(null),
  category: Joi.string().valid('Community Service', 'Environmental', 'Health', 'Education', 'Other').allow(null, ''),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null, ''),
  banner_image_url: Joi.string().max(500).allow(null, ''),
});

schemas.eventUpdate = Joi.object({
  title: Joi.string().trim().min(1).max(200).allow(null),
  description: Joi.string().allow(null, ''),
  event_date: Joi.date().iso().allow(null),
  location: Joi.string().max(255).allow(null, ''),
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'CLOSED').allow(null),
  organizer_id: Joi.string().uuid().allow(null),
  category: Joi.string().valid('Community Service', 'Environmental', 'Health', 'Education', 'Other').allow(null, ''),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null, ''),
  banner_image_url: Joi.string().max(500).allow(null, ''),
});

schemas.application = Joi.object({
  event_role_id: Joi.string().uuid().required(),
});

schemas.decide = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
});

schemas.attendanceMark = Joi.object({
  application_id: Joi.string().uuid().required(),
  status: Joi.string().valid('PRESENT', 'ABSENT', 'EXCUSED').required(),
  check_in_time: Joi.date().iso().allow(null, ''),
  check_out_time: Joi.date().iso().allow(null, ''),
});

schemas.attendanceHours = Joi.object({
  application_id: Joi.string().uuid().required(),
  hours_logged: Joi.number().min(0).max(999.99).allow(null, ''),
});

module.exports = { validate, schemas };
