export const CLINIC_WEEK_DAYS = [
  { day_of_week: 1, day_name: "Monday" },
  { day_of_week: 2, day_name: "Tuesday" },
  { day_of_week: 3, day_name: "Wednesday" },
  { day_of_week: 4, day_name: "Thursday" },
  { day_of_week: 5, day_name: "Friday" },
  { day_of_week: 6, day_name: "Saturday" },
  { day_of_week: 7, day_name: "Sunday" },
];

export const createDefaultClinicOperatingHours = () =>
  CLINIC_WEEK_DAYS.map(({ day_of_week, day_name }) => ({
    day_of_week,
    day_name,
    is_open: day_of_week !== 7,
    opening_time: day_of_week !== 7 ? "10:00" : null,
    closing_time: day_of_week !== 7 ? "17:00" : null,
  }));

const normalizeTime = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const normalizeClinicOperatingHours = (value) => {
  let schedule = value;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    schedule = value.operating_hours_schedule;
  }

  if (typeof schedule === "string") {
    try {
      schedule = JSON.parse(schedule);
    } catch {
      schedule = null;
    }
  }

  if (!Array.isArray(schedule) || schedule.length === 0) {
    return createDefaultClinicOperatingHours();
  }

  const byDay = new Map(
    schedule.map((entry) => [Number(entry?.day_of_week), entry]),
  );

  return CLINIC_WEEK_DAYS.map(({ day_of_week, day_name }) => {
    const entry = byDay.get(day_of_week);
    const isOpen = Boolean(entry?.is_open);

    return {
      day_of_week,
      day_name,
      is_open: isOpen,
      opening_time: isOpen
        ? normalizeTime(entry?.opening_time) || "10:00"
        : null,
      closing_time: isOpen
        ? normalizeTime(entry?.closing_time) || "17:00"
        : null,
    };
  });
};

const formatTime = (value) => {
  const normalized = normalizeTime(value);
  if (!normalized) return "";

  const [hourText, minuteText] = normalized.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minuteText} ${suffix}`;
};

export const validateClinicOperatingHours = (value) => {
  const schedule = normalizeClinicOperatingHours(value);

  if (!schedule.some((entry) => entry.is_open)) {
    return "Select at least one open clinic day.";
  }

  for (const entry of schedule) {
    if (!entry.is_open) continue;

    if (!entry.opening_time || !entry.closing_time) {
      return `${entry.day_name} requires both opening and closing times.`;
    }

    if (entry.closing_time <= entry.opening_time) {
      return `${entry.day_name} closing time must be later than opening time.`;
    }
  }

  return "";
};

export const clinicOperatingHoursToSummary = (value) =>
  normalizeClinicOperatingHours(value)
    .map((entry) =>
      entry.is_open
        ? `${entry.day_name}: ${formatTime(entry.opening_time)} - ${formatTime(
            entry.closing_time,
          )}`
        : `${entry.day_name}: Closed`,
    )
    .join(", ");
