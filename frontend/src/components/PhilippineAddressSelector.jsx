import React, { useEffect, useMemo } from "react";
import {
  getRegions,
  getProvinces,
  getCitiesMunicipalities,
  getBarangays,
} from "../services/psgcService";

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
    <div className="auth-field">
      <label htmlFor={id}>{label} *</label>

      <select
        id={id}
        name={id}
        className="auth-input"
        value={value || ""}
        onChange={(event) => {
          const selectedValue = event.target.value;
          const selected =
            options.find((option) => option.value === selectedValue) || null;

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

export default function PhilippineAddressSelector({
  value,
  onChange,
  disabled = false,
}) {
  const regionOptions = useMemo(() => getRegions(), []);

  const provinceOptions = useMemo(
    () =>
      value.region_designation ? getProvinces(value.region_designation) : [],
    [value.region_designation],
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

  useEffect(() => {
    if (
      value.province &&
      !provinceOptions.some((option) => option.value === value.province)
    ) {
      onChange({
        province: "",
        city_municipality: "",
        barangay: "",
        barangay_code: "",
      });
    }
  }, [onChange, provinceOptions, value.province]);

  useEffect(() => {
    if (
      value.city_municipality &&
      !cityMunicipalityOptions.some(
        (option) => option.value === value.city_municipality,
      )
    ) {
      onChange({
        city_municipality: "",
        barangay: "",
        barangay_code: "",
      });
    }
  }, [cityMunicipalityOptions, onChange, value.city_municipality]);

  useEffect(() => {
    if (
      value.barangay &&
      !barangayOptions.some((option) => option.value === value.barangay)
    ) {
      onChange({
        barangay: "",
        barangay_code: "",
      });
    }
  }, [barangayOptions, onChange, value.barangay]);

  const handleRegionChange = (selected) => {
    onChange({
      region_designation: selected?.value || "",
      region: selected?.name || "",
      province: "",
      city_municipality: "",
      barangay: "",
      barangay_code: "",
    });
  };

  const handleProvinceChange = (selected) => {
    onChange({
      province: selected?.name || "",
      city_municipality: "",
      barangay: "",
      barangay_code: "",
    });
  };

  const handleCityMunicipalityChange = (selected) => {
    onChange({
      city_municipality: selected?.name || "",
      barangay: "",
      barangay_code: "",
    });
  };

  const handleBarangayChange = (selected) => {
    onChange({
      barangay: selected?.name || "",
      barangay_code: selected?.code || "",
    });
  };

  return (
    <div className="philippine-address-selector">
      <div className="auth-row">
        <AddressSelect
          id="region_designation"
          label="Region"
          value={value.region_designation}
          options={regionOptions}
          placeholder="Select region"
          onChange={handleRegionChange}
          disabled={disabled}
        />

        <AddressSelect
          id="province"
          label="Province"
          value={value.province}
          options={provinceOptions}
          placeholder="Select province"
          onChange={handleProvinceChange}
          disabled={disabled || !value.region_designation}
        />
      </div>

      <div className="auth-row">
        <AddressSelect
          id="city_municipality"
          label="City/Municipality"
          value={value.city_municipality}
          options={cityMunicipalityOptions}
          placeholder="Select city or municipality"
          onChange={handleCityMunicipalityChange}
          disabled={disabled || !value.province}
        />

        <AddressSelect
          id="barangay"
          label="Barangay"
          value={value.barangay}
          options={barangayOptions}
          placeholder="Select barangay"
          onChange={handleBarangayChange}
          disabled={disabled || !value.city_municipality}
        />
      </div>
    </div>
  );
}
