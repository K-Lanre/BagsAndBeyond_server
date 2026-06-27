const DEFAULT_SHIPPING_SETTINGS = {
  freeShippingThreshold: 50000,
  storeCountry: 'Nigeria',
  domesticDefaultShippingFee: 1500,
  internationalDefaultShippingFee: 25000
};

const parseJsonValue = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }
  return value;
};

const normalizeShippingSettings = (value) => {
  const settings = parseJsonValue(value, DEFAULT_SHIPPING_SETTINGS);
  return {
    freeShippingThreshold: Number(settings.freeShippingThreshold ?? DEFAULT_SHIPPING_SETTINGS.freeShippingThreshold),
    storeCountry: String(settings.storeCountry || DEFAULT_SHIPPING_SETTINGS.storeCountry).trim(),
    domesticDefaultShippingFee: Number(
      settings.domesticDefaultShippingFee ?? settings.defaultShippingFee ?? DEFAULT_SHIPPING_SETTINGS.domesticDefaultShippingFee
    ),
    internationalDefaultShippingFee: Number(
      settings.internationalDefaultShippingFee ?? DEFAULT_SHIPPING_SETTINGS.internationalDefaultShippingFee
    )
  };
};

const normalizeLocation = (value) => String(value || '').trim().toLowerCase();

const zoneMatchesCountry = (zone, country) => {
  const zoneCountry = normalizeLocation(zone.country);
  return zoneCountry && zoneCountry === normalizeLocation(country);
};

const findMatchingZone = (zones, country, state, city) => {
  const destinationState = normalizeLocation(state);
  const destinationCity = normalizeLocation(city);

  const countryZones = zones.filter((zone) => zoneMatchesCountry(zone, country));

  if (destinationCity) {
    const cityMatch = countryZones.find((zone) => {
      const zoneCity = normalizeLocation(zone.city);
      const zoneState = normalizeLocation(zone.state);
      return zoneCity === destinationCity && (!zoneState || !destinationState || zoneState === destinationState);
    });

    if (cityMatch) return { zone: cityMatch, matchLevel: 'city' };
  }

  if (destinationState) {
    const stateMatch = countryZones.find((zone) => {
      const zoneState = normalizeLocation(zone.state);
      const zoneCity = normalizeLocation(zone.city);
      return zoneState === destinationState && !zoneCity;
    });

    if (stateMatch) return { zone: stateMatch, matchLevel: 'state' };
  }

  const countryMatch = countryZones.find((zone) => !normalizeLocation(zone.state) && !normalizeLocation(zone.city));
  if (countryMatch) return { zone: countryMatch, matchLevel: 'country' };

  return { zone: null, matchLevel: 'default' };
};

const calculateShipping = async ({ subtotal, country, state, city, models, transaction }) => {
  const { ShippingZone, SystemSetting } = models;
  const parsedSubtotal = Number(subtotal || 0);

  const shippingSetting = await SystemSetting.findOne({
    where: { key: 'shipping' },
    transaction
  });

  const settings = normalizeShippingSettings(shippingSetting?.value);
  const destinationCountry = String(country || settings.storeCountry).trim();
  const isDomestic = normalizeLocation(destinationCountry) === normalizeLocation(settings.storeCountry);

  if (isDomestic && settings.freeShippingThreshold > 0 && parsedSubtotal >= settings.freeShippingThreshold) {
    return {
      shipping_cost: 0,
      zone: 'Free Shipping',
      match_level: 'free_shipping',
      estimated_days: null,
      settings,
      message: 'Eligible for free shipping'
    };
  }

  const zones = await ShippingZone.findAll({
    where: { is_active: true },
    order: [['price', 'ASC']],
    transaction
  });

  const { zone: selectedZone, matchLevel } = findMatchingZone(zones, destinationCountry, state, city);
  const defaultFee = isDomestic ? settings.domesticDefaultShippingFee : settings.internationalDefaultShippingFee;
  const shippingCost = selectedZone ? Number(selectedZone.price) : defaultFee;

  return {
    shipping_cost: shippingCost,
    zone: selectedZone?.name || (isDomestic ? 'Domestic Default Shipping' : 'International Default Shipping'),
    match_level: matchLevel,
    estimated_days: selectedZone?.estimated_days || null,
    settings,
    message: selectedZone ? `${matchLevel} shipping zone applied` : `${isDomestic ? 'Domestic' : 'International'} default shipping fee applied`
  };
};

module.exports = {
  DEFAULT_SHIPPING_SETTINGS,
  calculateShipping,
  normalizeShippingSettings
};
