import React, { useEffect, useMemo, useState } from "react";
import {
  getRegions,
  getProvinces,
  getCitiesMunicipalities,
  getBarangays,
} from "../services/psgcService";

const clean = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

export const buildPhilippineAddress = ({
  house_unit_number,
  street_name,
  subdivision,
  barangay,
  city_municipality,
  province,
  region,
  postal_code,
  country,
}) =>
  [
    house_unit_number,
    street_name,
    subdivision,
    barangay,
    city_municipality,
    province,
    region,
    postal_code,
    country || "Philippines",
  ]
    .map(clean)
    .filter(Boolean)
    .join(", ");

function AddressSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
}) {
  return (
    <div className="structured-address-field">
      <label htmlFor={id}>
        {label} <span className="auth-required">*</span>
      </label>

      <select
        id={id}
        name={id}
        className="structured-address-control"
        value={value || ""}
        onChange={(event) => {
          const selected =
            options.find((option) => option.value === event.target.value) ||
            null;

          onChange(selected);
        }}
        disabled={disabled}
        required
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function AddressInput({
  id,
  label,
  value,
  placeholder,
  onChange,
  required = false,
  maxLength,
  inputMode,
  disabled,
}) {
  return (
    <div className="structured-address-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="auth-required"> *</span>}
      </label>

      <input
        id={id}
        name={id}
        className="structured-address-control"
        value={value || ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        disabled={disabled}
      />
    </div>
  );
}

export default function PhilippineAddressFields({
  value = {},
  onChange,
  disabled = false,
  title = "Address",
  description = "Enter each part of the address in its proper field.",
  showHeading = true,
  requireHouseUnit = false,
  requireStreet = false,
  requireSubdivision = false,
  legacyAddress = "",
}) {
  const [regionDesignation, setRegionDesignation] = useState(
    value.region_designation || "",
  );

  useEffect(() => {
    setRegionDesignation(value.region_designation || "");
  }, [value.region_designation]);

  const regionOptions = useMemo(() => getRegions(), []);

  const provinceOptions = useMemo(
    () => (regionDesignation ? getProvinces(regionDesignation) : []),
    [regionDesignation],
  );

  const cityMunicipalityOptions = useMemo(
    () => (value.province ? getCitiesMunicipalities(value.province) : []),
    [value.province],
  );

  const barangayOptions = useMemo(
    () =>
      value.city_municipality ? getBarangays(value.city_municipality) : [],
    [value.city_municipality],
  );

  const emitChange = (updates) => {
    const nextValue = {
      house_unit_number: value.house_unit_number || "",
      street_name: value.street_name || "",
      subdivision: value.subdivision || "",
      region_designation: regionDesignation,
      region: value.region || "",
      province: value.province || "",
      city_municipality: value.city_municipality || "",
      barangay: value.barangay || "",
      barangay_code: value.barangay_code || "",
      postal_code: value.postal_code || "",
      country: value.country || "Philippines",
      ...updates,
    };

    nextValue.address = buildPhilippineAddress(nextValue);
    onChange(nextValue);
  };

  const selectRegion = (selected) => {
    const designation = selected?.value || "";

    setRegionDesignation(designation);

    emitChange({
      region_designation: designation,
      region: selected?.name || "",
      province: "",
      city_municipality: "",
      barangay: "",
      barangay_code: "",
    });
  };

  const selectProvince = (selected) => {
    emitChange({
      province: selected?.name || "",
      city_municipality: "",
      barangay: "",
      barangay_code: "",
    });
  };

  const selectCityMunicipality = (selected) => {
    emitChange({
      city_municipality: selected?.name || "",
      barangay: "",
      barangay_code: "",
    });
  };

  const selectBarangay = (selected) => {
    emitChange({
      barangay: selected?.name || "",
      barangay_code: selected?.code || "",
    });
  };

  return (
    <section className="structured-address-section">
      {showHeading && (
        <div className="structured-address-heading">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      )}

      {legacyAddress &&
        !value.region &&
        !value.province &&
        !value.city_municipality &&
        !value.barangay && (
          <div className="structured-address-legacy">
            <strong>Currently saved address:</strong>
            <span>{legacyAddress}</span>
            <small>
              Select the structured fields below to replace this legacy address.
            </small>
          </div>
        )}

      <div className="structured-address-grid">
        <AddressInput
          id="house_unit_number"
          label="House/Unit Number"
          value={value.house_unit_number}
          placeholder="Unit 2B or 123"
          onChange={(nextValue) => emitChange({ house_unit_number: nextValue })}
          required={requireHouseUnit}
          maxLength={30}
          disabled={disabled}
        />

        <AddressInput
          id="street_name"
          label="Street Name"
          value={value.street_name}
          placeholder="Rizal Street"
          onChange={(nextValue) => emitChange({ street_name: nextValue })}
          required={requireStreet}
          maxLength={100}
          disabled={disabled}
        />
      </div>

      <AddressInput
        id="subdivision"
        label="Subdivision/Village"
        value={value.subdivision}
        placeholder="Sample Village"
        onChange={(nextValue) => emitChange({ subdivision: nextValue })}
        required={requireSubdivision}
        maxLength={100}
        disabled={disabled}
      />

      <div className="structured-address-grid">
        <AddressSelect
          id="region_designation"
          label="Region"
          value={regionDesignation}
          options={regionOptions}
          placeholder="Select region"
          onChange={selectRegion}
          disabled={disabled}
        />

        <AddressSelect
          id="province"
          label="Province"
          value={value.province}
          options={provinceOptions}
          placeholder="Select province"
          onChange={selectProvince}
          disabled={disabled || !regionDesignation}
        />
      </div>

      <div className="structured-address-grid">
        <AddressSelect
          id="city_municipality"
          label="City/Municipality"
          value={value.city_municipality}
          options={cityMunicipalityOptions}
          placeholder="Select city or municipality"
          onChange={selectCityMunicipality}
          disabled={disabled || !value.province}
        />

        <AddressSelect
          id="barangay"
          label="Barangay"
          value={value.barangay}
          options={barangayOptions}
          placeholder="Select barangay"
          onChange={selectBarangay}
          disabled={disabled || !value.city_municipality}
        />
      </div>

      <div className="structured-address-grid">
        <AddressInput
          id="postal_code"
          label="Postal Code"
          value={value.postal_code}
          placeholder="1100"
          onChange={(nextValue) =>
            emitChange({
              postal_code: nextValue.replace(/\D/g, "").slice(0, 4),
            })
          }
          required
          maxLength={4}
          inputMode="numeric"
          disabled={disabled}
        />

        <AddressInput
          id="country"
          label="Country"
          value={value.country || "Philippines"}
          onChange={() => {}}
          required
          disabled
        />
      </div>
    </section>
  );
}
