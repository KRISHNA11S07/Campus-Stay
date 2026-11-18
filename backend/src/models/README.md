const { z } = require('zod');
const schema = z.object({
  users: 'string',
  ownerProfiles: 'string',
  colleges: 'string',
  properties: 'string',
  propertyPhotos: 'string',
  inquiries: 'string',
  favourites: 'string',
  propertyViews: 'string',
  reports: 'string',
  notifications: 'string',
  reviews: 'string'
});

module.exports = { schema };
