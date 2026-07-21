import { regions, provinces, municipalities, barangays } from "psgc";

const clean = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const sortByName = (items = []) =>
  [...items].sort((a, b) => clean(a.name).localeCompare(clean(b.name)));

export const getRegions = () =>
  sortByName(regions.all()).map((item) => ({
    value: item.designation,
    name: item.name,
  }));

export const getProvinces = (regionDesignation) =>
  sortByName(
    provinces
      .all()
      .filter(
        (item) =>
          clean(item.region).toLowerCase() ===
          clean(regionDesignation).toLowerCase(),
      ),
  ).map((item) => ({
    value: item.name,
    name: item.name,
  }));

export const getCitiesMunicipalities = (provinceName) =>
  sortByName(
    municipalities
      .all()
      .filter(
        (item) =>
          clean(item.province).toLowerCase() ===
          clean(provinceName).toLowerCase(),
      ),
  ).map((item) => ({
    value: item.name,
    name: item.name,
    isCity: Boolean(item.city),
  }));

export const getBarangays = (cityMunicipalityName) =>
  sortByName(
    barangays
      .all()
      .filter(
        (item) =>
          clean(item.citymun).toLowerCase() ===
          clean(cityMunicipalityName).toLowerCase(),
      ),
  ).map((item) => ({
    value: item.name,
    name: item.name,
    code: item.code || null,
  }));
