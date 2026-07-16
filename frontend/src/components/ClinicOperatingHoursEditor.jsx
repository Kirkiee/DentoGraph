import React from "react";
import { normalizeClinicOperatingHours } from "../utils/clinicOperatingHours";

function ClinicOperatingHoursEditor({
  value,
  onChange,
  disabled = false,
  compact = false,
}) {
  const schedule = normalizeClinicOperatingHours(value);

  const updateDay = (dayOfWeek, patch) => {
    const nextSchedule = schedule.map((entry) => {
      if (entry.day_of_week !== dayOfWeek) return entry;

      const nextEntry = { ...entry, ...patch };

      if (!nextEntry.is_open) {
        nextEntry.opening_time = null;
        nextEntry.closing_time = null;
      } else {
        nextEntry.opening_time = nextEntry.opening_time || "10:00";
        nextEntry.closing_time = nextEntry.closing_time || "17:00";
      }

      return nextEntry;
    });

    onChange(nextSchedule);
  };

  return (
    <fieldset
      className={`clinic-hours-editor ${
        compact ? "clinic-hours-editor-compact" : ""
      }`}
    >
      <legend>
        Weekly Operating Hours <span className="auth-required">*</span>
      </legend>

      <p className="clinic-hours-editor-help">
        Set the opening and closing time for every operating day.
      </p>

      <div className="clinic-hours-editor-list">
        {schedule.map((entry) => (
          <div className="clinic-hours-editor-row" key={entry.day_of_week}>
            <label className="clinic-hours-open-toggle">
              <input
                type="checkbox"
                checked={entry.is_open}
                onChange={(event) =>
                  updateDay(entry.day_of_week, {
                    is_open: event.target.checked,
                  })
                }
                disabled={disabled}
              />
              <span>{entry.day_name}</span>
            </label>

            {entry.is_open ? (
              <div className="clinic-hours-time-fields">
                <label>
                  <span>Open</span>
                  <input
                    type="time"
                    value={entry.opening_time || ""}
                    onChange={(event) =>
                      updateDay(entry.day_of_week, {
                        opening_time: event.target.value,
                      })
                    }
                    disabled={disabled}
                  />
                </label>

                <span className="clinic-hours-separator">to</span>

                <label>
                  <span>Close</span>
                  <input
                    type="time"
                    value={entry.closing_time || ""}
                    onChange={(event) =>
                      updateDay(entry.day_of_week, {
                        closing_time: event.target.value,
                      })
                    }
                    disabled={disabled}
                  />
                </label>
              </div>
            ) : (
              <span className="clinic-hours-closed-label">Closed</span>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export default ClinicOperatingHoursEditor;
