export const CLINIC_SERVICE_CATEGORIES = [
  {
    category: "Consultation and Preventive Care",
    services: [
      "Dental Consultation",
      "Comprehensive Oral Examination",
      "Routine Dental Check-up",
      "Treatment Planning",
      "Oral Health Education",
      "Dental Prophylaxis / Teeth Cleaning",
      "Deep Cleaning / Scaling and Root Planing",
      "Fluoride Treatment",
      "Pit and Fissure Sealants",
      "Oral Cancer Screening",
      "Periodontal Screening",
      "Halitosis / Bad Breath Management",
      "Preventive Dentistry",
    ],
  },
  {
    category: "Diagnostic and Imaging Services",
    services: [
      "Digital Dental X-ray",
      "Periapical X-ray",
      "Bitewing X-ray",
      "Occlusal X-ray",
      "Panoramic X-ray",
      "Cephalometric X-ray",
      "Cone Beam CT / CBCT Scan",
      "Intraoral Photography",
      "Digital Dental Scanning",
      "Study Casts / Dental Impressions",
      "Temporomandibular Joint / TMJ Assessment",
    ],
  },
  {
    category: "Restorative Dentistry",
    services: [
      "Tooth-Colored Filling / Composite Restoration",
      "Amalgam Filling",
      "Temporary Filling",
      "Glass Ionomer Restoration",
      "Inlay and Onlay",
      "Dental Bonding",
      "Full-Mouth Rehabilitation",
      "Restoration Repair or Replacement",
    ],
  },
  {
    category: "Endodontic Services",
    services: [
      "Root Canal Treatment",
      "Root Canal Retreatment",
      "Pulpotomy",
      "Pulpectomy",
      "Vital Pulp Therapy",
      "Apicoectomy",
      "Management of Dental Abscess",
      "Emergency Endodontic Treatment",
    ],
  },
  {
    category: "Oral Surgery and Extractions",
    services: [
      "Simple Tooth Extraction",
      "Surgical Tooth Extraction",
      "Wisdom Tooth Extraction",
      "Impacted Tooth Surgery",
      "Alveoloplasty",
      "Frenectomy",
      "Gingivectomy",
      "Incision and Drainage",
      "Biopsy of Oral Lesions",
      "Removal of Oral Cysts",
      "Pre-Prosthetic Surgery",
      "Management of Dental Trauma",
      "Emergency Dental Care",
    ],
  },
  {
    category: "Periodontal and Gum Care",
    services: [
      "Gingivitis Treatment",
      "Periodontitis Treatment",
      "Scaling and Root Planing",
      "Periodontal Maintenance",
      "Gum Contouring",
      "Gum Grafting",
      "Crown Lengthening",
      "Periodontal Surgery",
      "Bone Grafting",
      "Guided Tissue Regeneration",
      "Peri-Implant Disease Management",
    ],
  },
  {
    category: "Prosthodontics and Tooth Replacement",
    services: [
      "Complete Dentures",
      "Partial Dentures",
      "Flexible Dentures",
      "Immediate Dentures",
      "Denture Repair",
      "Denture Reline or Rebase",
      "Dental Crowns",
      "Dental Bridges",
      "Porcelain-Fused-to-Metal Crowns",
      "Zirconia Crowns",
      "E-Max Crowns and Veneers",
      "Implant-Supported Crown",
      "Implant-Supported Bridge",
      "Implant-Supported Denture",
      "Dental Implant Placement",
      "Dental Implant Restoration",
      "Maxillofacial Prosthetics",
    ],
  },
  {
    category: "Orthodontic Services",
    services: [
      "Orthodontic Consultation",
      "Metal Braces",
      "Ceramic Braces",
      "Self-Ligating Braces",
      "Lingual Braces",
      "Clear Aligners",
      "Retainers",
      "Space Maintainers",
      "Habit-Breaking Appliances",
      "Palatal Expander",
      "Functional Orthodontic Appliances",
      "Interceptive Orthodontics",
      "Orthodontic Adjustment",
      "Braces Removal",
      "Dentofacial Orthopedics",
    ],
  },
  {
    category: "Cosmetic and Aesthetic Dentistry",
    services: [
      "Professional Teeth Whitening",
      "Dental Veneers",
      "Composite Veneers",
      "Porcelain Veneers",
      "Smile Design",
      "Cosmetic Dental Bonding",
      "Tooth Recontouring",
      "Gum Depigmentation",
      "Gummy Smile Correction",
      "Diastema / Gap Closure",
      "Tooth Jewelry",
    ],
  },
  {
    category: "Pediatric Dentistry",
    services: [
      "Pediatric Dental Consultation",
      "Pediatric Oral Examination",
      "Pediatric Dental Cleaning",
      "Fluoride Treatment for Children",
      "Pit and Fissure Sealants for Children",
      "Pediatric Tooth Filling",
      "Pulpotomy for Primary Teeth",
      "Pulpectomy for Primary Teeth",
      "Stainless Steel Crown",
      "Primary Tooth Extraction",
      "Space Maintainer",
      "Early Orthodontic Assessment",
      "Behavior Management for Children",
      "Special Needs Pediatric Dentistry",
    ],
  },
  {
    category: "TMJ, Orofacial Pain, and Sleep Dentistry",
    services: [
      "TMJ Disorder Management",
      "Orofacial Pain Management",
      "Bruxism / Teeth Grinding Management",
      "Night Guard / Occlusal Splint",
      "Sports Mouthguard",
      "Sleep Apnea Oral Appliance",
      "Snoring Appliance",
      "Occlusal Adjustment",
    ],
  },
  {
    category: "Special Care and Sedation",
    services: [
      "Dental Care for Persons with Disabilities",
      "Geriatric Dentistry",
      "Dental Care for Medically Compromised Patients",
      "Dental Anxiety Management",
      "Conscious Sedation",
      "Nitrous Oxide Sedation",
      "Local Anesthesia",
      "Hospital-Based Dental Treatment",
      "Home-Service Dentistry",
    ],
  },
];

export const CLINIC_SERVICE_OPTIONS = CLINIC_SERVICE_CATEGORIES.flatMap(
  (group) => group.services,
);

export const normalizeClinicServiceName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const getClinicServiceNames = (clinicOrServices) => {
  if (Array.isArray(clinicOrServices)) {
    return [
      ...new Map(
        clinicOrServices
          .map((service) =>
            normalizeClinicServiceName(
              typeof service === "string" ? service : service?.service_name,
            ),
          )
          .filter(Boolean)
          .map((serviceName) => [serviceName.toLowerCase(), serviceName]),
      ).values(),
    ];
  }

  if (
    clinicOrServices &&
    typeof clinicOrServices === "object" &&
    Array.isArray(clinicOrServices.service_options)
  ) {
    return getClinicServiceNames(clinicOrServices.service_options);
  }

  const rawValue =
    clinicOrServices && typeof clinicOrServices === "object"
      ? clinicOrServices.services
      : clinicOrServices;

  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (Array.isArray(parsedValue)) {
      return getClinicServiceNames(parsedValue);
    }
  } catch {
    // Legacy fallback while public.clinics.services is still available.
  }

  return [
    ...new Map(
      rawValue
        .split(",")
        .map(normalizeClinicServiceName)
        .filter(Boolean)
        .map((serviceName) => [serviceName.toLowerCase(), serviceName]),
    ).values(),
  ];
};

export const clinicServicesToDisplayText = (clinicOrServices) =>
  getClinicServiceNames(clinicOrServices).join(", ");
