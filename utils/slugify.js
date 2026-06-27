/**
 * Generate a URL-friendly slug from a string
 * e.g. "Classic Leather Tote" => "classic-leather-tote"
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')           // Spaces to hyphens
    .replace(/-+/g, '-');           // Collapse multiple hyphens
};

/**
 * Generate a unique slug by appending a random suffix if needed
 * e.g. "classic-leather-tote-a3f2"
 */
const generateUniqueSlug = async (name, Model, excludeId = null) => {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 0;

  while (true) {
    const query = { where: { slug } };
    if (excludeId) {
      const { Op } = require('sequelize');
      query.where.id = { [Op.ne]: excludeId };
    }
    const existing = await Model.findOne(query);
    if (!existing) break;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
};

module.exports = { generateSlug, generateUniqueSlug };
