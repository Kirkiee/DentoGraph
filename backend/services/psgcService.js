const { regions, provinces, municipalities, barangays } = require("psgc");

const clean = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const same = (left, right) =>
  clean(left).toLowerCase() === clean(right).toLowerCase();

const validatePhilippineAddressHierarchy = ({
  region_designation,
  region,
  province,
  city_municipality,
  barangay,
  barangay_code,
}) => {
  const errors = {};

  const selectedRegion = regions
    .all()
    .find(
      (item) =>
        same(item.designation, region_designation) && same(item.name, region),
    );

  if (!selectedRegion) {
    errors.region = "Please select a valid Philippine region.";
    return errors;
  }

  const selectedProvince = provinces
    .all()
    .find(
      (item) =>
        same(item.region, selectedRegion.designation) &&
        same(item.name, province),
    );

  if (!selectedProvince) {
    errors.province =
      "The selected province does not belong to the selected region.";
    return errors;
  }

  const selectedCityMunicipality = municipalities
    .all()
    .find(
      (item) =>
        same(item.province, selectedProvince.name) &&
        same(item.name, city_municipality),
    );

  if (!selectedCityMunicipality) {
    errors.city_municipality =
      "The selected city or municipality does not belong to the selected province.";
    return errors;
  }

  const matchingBarangays = barangays
    .all()
    .filter(
      (item) =>
        same(item.citymun, selectedCityMunicipality.name) &&
        same(item.name, barangay),
    );

  const selectedBarangay = barangay_code
    ? matchingBarangays.find((item) => same(item.code, barangay_code))
    : matchingBarangays[0];

  if (!selectedBarangay) {
    errors.barangay =
      "The selected barangay does not belong to the selected city or municipality.";
  }

  return errors;
};

module.exports = {
  validatePhilippineAddressHierarchy,
};
