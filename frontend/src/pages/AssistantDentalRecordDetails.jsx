import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";

const ADULT_TOOTH_NUMBERS = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33,
  34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
];

const CHILD_TOOTH_NUMBERS = [
  51, 52, 53, 54, 55, 61, 62, 63, 64, 65, 71, 72, 73, 74, 75, 81, 82, 83, 84,
  85,
];

const TOOTH_STATUS_OPTIONS = [
  { value: "Sound", label: "Sound / Normal" },
  { value: "Caries", label: "Caries / Decayed" },
  { value: "Filled", label: "Filled / Restored" },
  { value: "Missing", label: "Missing / Extracted" },
  { value: "Crown", label: "Crown" },
  { value: "Impacted", label: "Impacted" },
  { value: "Root Canal Treated", label: "Root Canal Treated" },
  { value: "For Extraction", label: "For Extraction" },
];

const OLD_RECORD_DOCUMENT_TYPES = [
  {
    value: "SCANNED_OLD_RECORD",
    label: "Scanned Old Record",
  },
  {
    value: "OLD_DENTAL_RECORD",
    label: "Old Dental Record",
  },
  {
    value: "MANUALLY_ENCODED_OLD_RECORD",
    label: "Manually Encoded Old Record",
  },
];

const RECORD_SOURCE_OPTIONS = [
  {
    value: "NEW_SYSTEM_RECORD",
    label: "New System Record",
  },
  {
    value: "OLD_ENCODED_RECORD",
    label: "Old Encoded Record",
  },
  {
    value: "SCANNED_OLD_RECORD",
    label: "Scanned Old Record",
  },
];

function AssistantDentalRecordDetails() {
  const { record_id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [teeth, setTeeth] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [xrays, setXrays] = useState([]);
  const [toothStatusHistory, setToothStatusHistory] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);

  const [addingTooth, setAddingTooth] = useState(false);
  const [updatingTooth, setUpdatingTooth] = useState(false);
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);

  const [showToothModal, setShowToothModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showPdaModal, setShowPdaModal] = useState(false);
  const [showOldRecordModal, setShowOldRecordModal] = useState(false);
  const [showDeleteDocumentModal, setShowDeleteDocumentModal] = useState(false);

  const [selectedTooth, setSelectedTooth] = useState(null);
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [selectedHistoryTooth, setSelectedHistoryTooth] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const [reasonMode, setReasonMode] = useState("update");
  const [reasonText, setReasonText] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [pendingTooth, setPendingTooth] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);

  const [toothForm, setToothForm] = useState({
    tooth_number: "",
    tooth_status: "Sound",
    notes: "",
  });

  const [treatmentForm, setTreatmentForm] = useState({
    tooth_id: "",
    procedure_type: "",
    description: "",
    treatment_date: "",
  });

  const [pdaForm, setPdaForm] = useState({
    file: null,
    notes: "",
  });

  const [oldRecordForm, setOldRecordForm] = useState({
    file: null,
    document_type: "SCANNED_OLD_RECORD",
    notes: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchRecordDetails();
    fetchXrays();
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record_id]);

  useEffect(() => {
    const isAnyModalOpen =
      showToothModal ||
      showTreatmentModal ||
      showHistoryModal ||
      showReasonModal ||
      showPdaModal ||
      showOldRecordModal ||
      showDeleteDocumentModal;

    if (isAnyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [
    showToothModal,
    showTreatmentModal,
    showHistoryModal,
    showReasonModal,
    showPdaModal,
    showOldRecordModal,
    showDeleteDocumentModal,
  ]);

  const fetchRecordDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        `/api/dental-records/${record_id}`,
        authHeaders,
      );

      setRecord(response.data.dental_record || null);
      setTeeth(response.data.teeth || []);
      setTreatments(response.data.treatments || []);
      setToothStatusHistory(response.data.tooth_status_history || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dental record details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchXrays = async () => {
    try {
      setLoadingXrays(true);

      const response = await API.get(
        `/api/xrays/record/${record_id}`,
        authHeaders,
      );

      setXrays(response.data.xrays || []);
    } catch (err) {
      console.error("Fetch X-rays error:", err);
    } finally {
      setLoadingXrays(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoadingDocuments(true);

      const response = await API.get(
        `/api/patient-documents/record/${record_id}/documents`,
        authHeaders,
      );

      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error("Fetch patient documents error:", err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const refreshAll = () => {
    fetchRecordDetails();
    fetchXrays();
    fetchDocuments();
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleString();
  };

  const formatDateTimeLocal = (dateValue) => {
    if (!dateValue) return "";

    const date = new Date(dateValue);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);

    return localDate.toISOString().slice(0, 16);
  };

  const getRecordDentitionType = () => {
    return record?.dentition_type === "Child" ? "Child" : "Adult";
  };

  const getDentitionLabel = () => {
    if (record?.dentition_label) return record.dentition_label;

    return getRecordDentitionType() === "Child"
      ? "Child / Primary Teeth"
      : "Adult / Permanent Teeth";
  };

  const getValidToothNumbers = () => {
    if (Array.isArray(record?.valid_tooth_numbers)) {
      return record.valid_tooth_numbers.map((value) => Number(value));
    }

    return getRecordDentitionType() === "Child"
      ? CHILD_TOOTH_NUMBERS
      : ADULT_TOOTH_NUMBERS;
  };

  const getToothGuideText = () => {
    if (getRecordDentitionType() === "Child") {
      return "Valid primary FDI tooth numbers are 51-55, 61-65, 71-75, and 81-85. Teeth already added to this record are hidden from the list.";
    }

    return "Valid permanent FDI tooth numbers are 11-18, 21-28, 31-38, and 41-48. Teeth already added to this record are hidden from the list.";
  };

  const normalizeToothStatusLabel = (status) => {
    switch (status) {
      case "Normal":
      case "Sound":
        return "Sound / Normal";
      case "Decayed":
      case "Caries":
        return "Caries / Decayed";
      case "Filled":
        return "Filled / Restored";
      case "Missing":
        return "Missing / Extracted";
      case "Crowned":
      case "Crown":
        return "Crown";
      case "Impacted":
        return "Impacted";
      case "Root Canal Treated":
        return "Root Canal Treated";
      case "For Extraction":
        return "For Extraction";
      default:
        return status || "Sound / Normal";
    }
  };

  const normalizeToothStatusValue = (status) => {
    switch (status) {
      case "Normal":
        return "Sound";
      case "Decayed":
        return "Caries";
      case "Crowned":
        return "Crown";
      default:
        return status || "Sound";
    }
  };

  const getDocumentTypeLabel = (documentType) => {
    switch (documentType) {
      case "PDA_DENTAL_CHART":
        return "Dental Chart / Form";
      case "OLD_DENTAL_RECORD":
        return "Old Dental Record";
      case "SCANNED_OLD_RECORD":
        return "Scanned Old Record";
      case "MANUALLY_ENCODED_OLD_RECORD":
        return "Manually Encoded Old Record";
      default:
        return documentType || "Patient Document";
    }
  };

  const getRecordSourceLabel = (source) => {
    const match = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === source,
    );

    return (
      match?.label ||
      (source === "PDA_BASED_RECORD"
        ? "Imported / Old Record"
        : "New System Record")
    );
  };

  const getRecordSourceClass = (source) => {
    switch (source) {
      case "OLD_ENCODED_RECORD":
        return "status-badge status-pending";
      case "SCANNED_OLD_RECORD":
        return "status-badge status-scheduled";
      case "PDA_BASED_RECORD":
        return "status-badge status-completed";
      case "NEW_SYSTEM_RECORD":
      default:
        return "status-badge status-scheduled";
    }
  };

  const getToothHistory = (toothNumber) => {
    return toothStatusHistory.filter(
      (history) => String(history.tooth_number) === String(toothNumber),
    );
  };

  const getLatestToothHistory = (toothNumber) => {
    const history = getToothHistory(toothNumber);
    return history.length > 0 ? history[0] : null;
  };

  const formatHistoryChange = (history) => {
    if (!history) return "No recorded change.";

    const oldStatus = history.old_status
      ? normalizeToothStatusLabel(history.old_status)
      : "No previous status";

    const newStatus = normalizeToothStatusLabel(history.new_status);

    return `${oldStatus} → ${newStatus}`;
  };

  const getToothStatusClass = (status) => {
    switch (status) {
      case "Caries":
      case "Decayed":
      case "For Extraction":
      case "Missing":
        return "status-badge status-cancelled";

      case "Filled":
      case "Root Canal Treated":
        return "status-badge status-pending";

      case "Crown":
      case "Crowned":
      case "Impacted":
        return "status-badge status-scheduled";

      case "Sound":
      case "Normal":
      default:
        return "status-badge status-completed";
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    const normalizedPath = String(filePath).replace(/\\/g, "/");

    if (
      normalizedPath.startsWith("http://") ||
      normalizedPath.startsWith("https://")
    ) {
      return normalizedPath;
    }

    const pathWithSlash = normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;

    return `${baseURL}${pathWithSlash}`;
  };

  const getAvailableToothNumbers = () => {
    const usedToothNumbers = teeth.map((tooth) => Number(tooth.tooth_number));
    const validToothNumbers = getValidToothNumbers();

    return validToothNumbers.filter(
      (toothNumber) => !usedToothNumbers.includes(toothNumber),
    );
  };

  const openToothModal = () => {
    const availableToothNumbers = getAvailableToothNumbers();

    setToothForm({
      tooth_number: availableToothNumbers[0]
        ? String(availableToothNumbers[0])
        : "",
      tooth_status: "Sound",
      notes: "",
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowToothModal(true);
  };

  const closeToothModal = () => {
    setShowToothModal(false);
    setModalError("");
    setToothForm({
      tooth_number: "",
      tooth_status: "Sound",
      notes: "",
    });
  };

  const handleToothChange = (e) => {
    setModalError("");

    setToothForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddTooth = async (e) => {
    e.preventDefault();

    if (!toothForm.tooth_number) {
      setModalError("Please select a valid tooth number.");
      return;
    }

    try {
      setAddingTooth(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.post(
        `/api/dental-records/${record_id}/teeth`,
        {
          tooth_number: Number(toothForm.tooth_number),
          tooth_status: toothForm.tooth_status,
          notes:
            toothForm.notes || "Tooth status added from assistant record page.",
        },
        authHeaders,
      );

      setMessage("Tooth added successfully.");
      closeToothModal();
      fetchRecordDetails();
    } catch (err) {
      setModalError(err.response?.data?.error || "Unable to add tooth.");
    } finally {
      setAddingTooth(false);
    }
  };

  const openReasonModal = (mode, tooth, statusValue = null) => {
    setReasonMode(mode);
    setPendingTooth(tooth);
    setPendingStatus(statusValue);
    setReasonText("");
    setReasonError("");
    setShowReasonModal(true);
  };

  const closeReasonModal = () => {
    if (updatingTooth) return;

    setShowReasonModal(false);
    setReasonMode("update");
    setReasonText("");
    setReasonError("");
    setPendingTooth(null);
    setPendingStatus(null);
  };

  const handleUpdateToothStatus = (tooth, newStatus) => {
    const oldStatus = normalizeToothStatusValue(tooth.tooth_status);

    if (oldStatus === newStatus) {
      return;
    }

    openReasonModal("update", tooth, newStatus);
  };

  const handleRemoveToothStatus = (tooth) => {
    const oldStatus = normalizeToothStatusValue(tooth.tooth_status);

    if (oldStatus === "Sound") {
      setMessage(`Tooth #${tooth.tooth_number} is already Sound / Normal.`);
      return;
    }

    openReasonModal("remove", tooth, "Sound");
  };

  const handleConfirmReasonAction = async (e) => {
    e.preventDefault();

    if (!pendingTooth) {
      setReasonError("No tooth selected.");
      return;
    }

    const cleanReason = reasonText.trim();

    if (!cleanReason) {
      setReasonError("Please enter a reason or notes for this change.");
      return;
    }

    try {
      setUpdatingTooth(true);
      setMessage("");
      setError("");
      setReasonError("");

      if (reasonMode === "update") {
        await API.put(
          `/api/dental-records/teeth/${pendingTooth.tooth_id}`,
          {
            tooth_status: pendingStatus,
            notes: cleanReason,
          },
          authHeaders,
        );

        setMessage(
          `Tooth #${pendingTooth.tooth_number} updated from ${normalizeToothStatusLabel(
            pendingTooth.tooth_status,
          )} to ${normalizeToothStatusLabel(pendingStatus)}.`,
        );
      }

      if (reasonMode === "remove") {
        await API.delete(
          `/api/dental-records/teeth/${pendingTooth.tooth_id}/status`,
          {
            ...authHeaders,
            data: {
              notes: cleanReason,
            },
          },
        );

        setMessage(`Tooth #${pendingTooth.tooth_number} status removed/reset.`);
      }

      closeReasonModal();
      fetchRecordDetails();
    } catch (err) {
      setReasonError(
        err.response?.data?.error ||
          (reasonMode === "remove"
            ? "Unable to remove tooth status."
            : "Unable to update tooth status."),
      );
    } finally {
      setUpdatingTooth(false);
    }
  };

  const openHistoryModal = (tooth) => {
    setSelectedHistoryTooth(tooth);
    setShowHistoryModal(true);
  };

  const closeHistoryModal = () => {
    setSelectedHistoryTooth(null);
    setShowHistoryModal(false);
  };

  const openAddTreatmentModal = (tooth = null) => {
    setSelectedTooth(tooth);
    setSelectedTreatment(null);

    setTreatmentForm({
      tooth_id: tooth?.tooth_id || "",
      procedure_type: "",
      description: "",
      treatment_date: formatDateTimeLocal(new Date()),
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowTreatmentModal(true);
  };

  const openEditTreatmentModal = (treatment) => {
    setSelectedTreatment(treatment);

    const matchingTooth = teeth.find(
      (tooth) => Number(tooth.tooth_id) === Number(treatment.tooth_id),
    );

    setSelectedTooth(matchingTooth || null);

    setTreatmentForm({
      tooth_id: treatment.tooth_id || "",
      procedure_type: treatment.procedure_type || "",
      description: treatment.description || "",
      treatment_date: formatDateTimeLocal(treatment.treatment_date),
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowTreatmentModal(true);
  };

  const closeTreatmentModal = () => {
    setShowTreatmentModal(false);
    setSelectedTooth(null);
    setSelectedTreatment(null);
    setModalError("");

    setTreatmentForm({
      tooth_id: "",
      procedure_type: "",
      description: "",
      treatment_date: "",
    });
  };

  const handleTreatmentChange = (e) => {
    setModalError("");

    setTreatmentForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveTreatment = async (e) => {
    e.preventDefault();

    if (!treatmentForm.tooth_id || !treatmentForm.procedure_type) {
      setModalError("Please select a tooth and enter a procedure type.");
      return;
    }

    if (selectedTreatment && !treatmentForm.treatment_date) {
      setModalError("Treatment date is required when updating a treatment.");
      return;
    }

    try {
      setSavingTreatment(true);
      setMessage("");
      setError("");
      setModalError("");

      if (selectedTreatment) {
        await API.put(
          `/api/dental-records/treatments/${selectedTreatment.treatment_id}`,
          {
            procedure_type: treatmentForm.procedure_type,
            description: treatmentForm.description,
            treatment_date: treatmentForm.treatment_date,
          },
          authHeaders,
        );

        setMessage("Treatment updated successfully.");
      } else {
        await API.post(
          `/api/dental-records/teeth/${treatmentForm.tooth_id}/treatments`,
          {
            procedure_type: treatmentForm.procedure_type,
            description: treatmentForm.description,
            treatment_date: treatmentForm.treatment_date || new Date(),
          },
          authHeaders,
        );

        setMessage("Treatment added successfully.");
      }

      closeTreatmentModal();
      fetchRecordDetails();
    } catch (err) {
      setModalError(
        err.response?.data?.error ||
          (selectedTreatment
            ? "Unable to update treatment."
            : "Unable to add treatment."),
      );
    } finally {
      setSavingTreatment(false);
    }
  };

  const openPdaModal = () => {
    setPdaForm({
      file: null,
      notes: "",
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowPdaModal(true);
  };

  const closePdaModal = () => {
    if (uploadingDocument) return;

    setShowPdaModal(false);
    setModalError("");
    setPdaForm({
      file: null,
      notes: "",
    });
  };

  const openOldRecordModal = () => {
    setOldRecordForm({
      file: null,
      document_type: "SCANNED_OLD_RECORD",
      notes: "",
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowOldRecordModal(true);
  };

  const closeOldRecordModal = () => {
    if (uploadingDocument) return;

    setShowOldRecordModal(false);
    setModalError("");
    setOldRecordForm({
      file: null,
      document_type: "SCANNED_OLD_RECORD",
      notes: "",
    });
  };

  const handlePdaUpload = async (e) => {
    e.preventDefault();

    if (!record?.patient_id) {
      setModalError("Patient information is missing.");
      return;
    }

    if (!pdaForm.file) {
      setModalError("Please select a PDA form file.");
      return;
    }

    try {
      setUploadingDocument(true);
      setMessage("");
      setError("");
      setModalError("");

      const formData = new FormData();
      formData.append("pda_form", pdaForm.file);
      formData.append("record_id", record_id);
      formData.append(
        "notes",
        pdaForm.notes || "PDA form uploaded from assistant dental record page.",
      );

      const response = await API.post(
        `/api/patient-documents/patient/${record.patient_id}/pda-form`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setMessage(response.data.message || "PDA form uploaded successfully.");
      closePdaModal();
      fetchDocuments();
    } catch (err) {
      setModalError(err.response?.data?.error || "Unable to upload PDA form.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleOldRecordUpload = async (e) => {
    e.preventDefault();

    if (!record?.patient_id) {
      setModalError("Patient information is missing.");
      return;
    }

    if (!oldRecordForm.file) {
      setModalError("Please select an old/scanned record file.");
      return;
    }

    try {
      setUploadingDocument(true);
      setMessage("");
      setError("");
      setModalError("");

      const formData = new FormData();
      formData.append("old_record", oldRecordForm.file);
      formData.append("record_id", record_id);
      formData.append("document_type", oldRecordForm.document_type);
      formData.append(
        "notes",
        oldRecordForm.notes ||
          "Old/scanned dental record uploaded from assistant dental record page.",
      );

      const response = await API.post(
        `/api/patient-documents/patient/${record.patient_id}/old-record`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setMessage(
        response.data.message || "Old/scanned record uploaded successfully.",
      );
      closeOldRecordModal();
      fetchDocuments();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to upload old/scanned record.",
      );
    } finally {
      setUploadingDocument(false);
    }
  };

  const openDeleteDocumentModal = (document) => {
    setSelectedDocument(document);
    setMessage("");
    setError("");
    setModalError("");
    setShowDeleteDocumentModal(true);
  };

  const closeDeleteDocumentModal = () => {
    if (deletingDocumentId) return;

    setSelectedDocument(null);
    setModalError("");
    setShowDeleteDocumentModal(false);
  };

  const handleDeleteDocument = async (e) => {
    e.preventDefault();

    if (!selectedDocument) {
      setModalError("No document selected.");
      return;
    }

    try {
      setDeletingDocumentId(selectedDocument.document_id);
      setMessage("");
      setError("");
      setModalError("");

      const response = await API.delete(
        `/api/patient-documents/documents/${selectedDocument.document_id}`,
        authHeaders,
      );

      setMessage(response.data.message || "Document removed successfully.");
      closeDeleteDocumentModal();
      fetchDocuments();
    } catch (err) {
      setModalError(err.response?.data?.error || "Unable to remove document.");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const availableToothNumbers = getAvailableToothNumbers();

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card dental-record-details-page">
        <div className="appointments-header">
          <div>
            <h2>Dental Record Details</h2>
            <p>
              View-only access for teeth, treatments, X-rays, documents, and 3D
              dental visualization connected to this dental record.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/assistant/dental-records")}
            >
              Back to Records
            </button>

            <button
              className="primary-button"
              onClick={() =>
                navigate(`/assistant/dental-records/${record_id}/3d-view`)
              }
              disabled={loading || !record}
            >
              3D View
            </button>

            <button
              className="secondary-button"
              onClick={refreshAll}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && record && (
          <div className="info-message">
            <strong>Read-only mode:</strong> Dental assistants can view tooth
            details, 3D chart, treatment history, X-rays, and documents. Editing
            tooth statuses, adding treatments, uploading documents, and deleting
            documents are disabled.
          </div>
        )}

        {loading ? (
          <p>Loading dental record details...</p>
        ) : !record ? (
          <div className="empty-state">
            <h3>Dental record not found</h3>
            <p>
              The selected dental record may not exist or may be unavailable.
            </p>
          </div>
        ) : (
          <>
            <div className="appointment-item">
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Record #{record.record_id}</h3>

                  <span className="status-badge status-scheduled">
                    {record.status || "Active"}
                  </span>
                </div>

                <p>
                  <strong>Patient:</strong>{" "}
                  {record.patient_name || `Patient ID ${record.patient_id}`}
                </p>

                <p>
                  <strong>Patient Email:</strong>{" "}
                  {record.patient_email || "N/A"}
                </p>

                <p>
                  <strong>Patient Type:</strong> {getDentitionLabel()}
                </p>

                <p>
                  <strong>Record Source:</strong>{" "}
                  <span className={getRecordSourceClass(record.record_source)}>
                    {getRecordSourceLabel(record.record_source)}
                  </span>
                </p>

                {record.source_notes && (
                  <p>
                    <strong>Source Notes:</strong> {record.source_notes}
                  </p>
                )}

                <p>
                  <strong>Dentist:</strong>{" "}
                  {record.dentist_name || `Dentist ID ${record.dentist_id}`}
                </p>

                <p>
                  <strong>Clinic:</strong>{" "}
                  {record.clinic_name || "No assigned clinic"}
                </p>

                <p>
                  <strong>Date Created:</strong>{" "}
                  {formatDate(record.date_created)}
                </p>

                <p>
                  <strong>Last Updated:</strong>{" "}
                  {formatDate(record.last_updated)}
                </p>
              </div>
            </div>

            <div className="info-message">
              <strong>Tooth Numbering Guide:</strong> {getToothGuideText()}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Teeth Overview</h2>
                  <p>
                    View valid FDI tooth numbers, recorded tooth statuses, and
                    the 3D chart for a visual tooth map.
                  </p>
                </div>

                <div
                  className="appointment-actions"
                  style={{ flexDirection: "row" }}
                >
                  <button
                    className="secondary-button"
                    onClick={() =>
                      navigate(`/assistant/dental-records/${record_id}/3d-view`)
                    }
                  >
                    Open 3D Chart
                  </button>
                </div>
              </div>

              {teeth.length === 0 ? (
                <div className="empty-state">
                  <h3>No teeth added</h3>
                  <p>
                    No tooth status data has been added to this dental record
                    yet.
                  </p>
                </div>
              ) : (
                <div className="appointments-list">
                  {teeth.map((tooth) => {
                    const latestHistory = getLatestToothHistory(
                      tooth.tooth_number,
                    );
                    const toothHistory = getToothHistory(tooth.tooth_number);

                    return (
                      <div className="appointment-item" key={tooth.tooth_id}>
                        <div className="appointment-info">
                          <div className="appointment-title-row">
                            <h3>Tooth #{tooth.tooth_number}</h3>

                            <span
                              className={getToothStatusClass(
                                tooth.tooth_status || "Sound",
                              )}
                            >
                              {normalizeToothStatusLabel(
                                tooth.tooth_status || "Sound",
                              )}
                            </span>
                          </div>

                          <p>
                            <strong>Tooth ID:</strong> {tooth.tooth_id}
                          </p>

                          <p>
                            <strong>Status:</strong>{" "}
                            {normalizeToothStatusLabel(
                              tooth.tooth_status || "Sound",
                            )}
                          </p>

                          {latestHistory && (
                            <p className="tooth-history-preview">
                              Last changed{" "}
                              {formatDate(latestHistory.created_at)} by{" "}
                              {latestHistory.changed_by_name || "Unknown"}
                            </p>
                          )}
                        </div>

                        <div className="appointment-actions">
                          <select
                            value={normalizeToothStatusValue(
                              tooth.tooth_status,
                            )}
                            disabled
                            title="Read-only for dental assistants"
                          >
                            {TOOTH_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <button
                            className="secondary-button"
                            onClick={() => openHistoryModal(tooth)}
                            disabled={toothHistory.length === 0}
                          >
                            View History
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Treatment History</h2>
                  <p>
                    View procedures recorded under this dental record. Adding
                    and editing treatments are disabled for dental assistants.
                  </p>
                </div>
              </div>

              {treatments.length === 0 ? (
                <div className="empty-state">
                  <h3>No treatments recorded</h3>
                  <p>Treatment history will appear here once added.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {treatments.map((treatment) => (
                    <div
                      className="appointment-item"
                      key={treatment.treatment_id}
                    >
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>{treatment.procedure_type}</h3>

                          <span className="status-badge status-scheduled">
                            Tooth #{treatment.tooth_number}
                          </span>
                        </div>

                        <p>
                          <strong>Treatment ID:</strong>{" "}
                          {treatment.treatment_id}
                        </p>

                        <p>
                          <strong>Description:</strong>{" "}
                          {treatment.description || "No description provided"}
                        </p>

                        <p>
                          <strong>Treatment Date:</strong>{" "}
                          {formatDate(treatment.treatment_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Patient Documents</h2>
                  <p>
                    View old records and scanned patient documents linked to
                    this dental record.
                  </p>
                </div>
              </div>

              {loadingDocuments ? (
                <p>Loading patient documents...</p>
              ) : documents.length === 0 ? (
                <div className="empty-state">
                  <h3>No patient documents uploaded</h3>
                  <p>
                    Uploaded old records and scanned documents will appear here.
                  </p>
                </div>
              ) : (
                <div className="appointments-list">
                  {documents.map((document) => (
                    <div
                      className="appointment-item"
                      key={document.document_id}
                    >
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>
                            {getDocumentTypeLabel(document.document_type)}
                          </h3>

                          <span className="status-badge status-scheduled">
                            Document #{document.document_id}
                          </span>
                        </div>

                        <p>
                          <strong>File:</strong>{" "}
                          {document.original_filename || "Uploaded file"}
                        </p>

                        <p>
                          <strong>Uploaded:</strong>{" "}
                          {formatDate(document.uploaded_at)}
                        </p>

                        <p>
                          <strong>Uploaded By:</strong>{" "}
                          {document.uploaded_by_name || "Unknown"}
                        </p>

                        {document.notes && (
                          <p>
                            <strong>Notes:</strong> {document.notes}
                          </p>
                        )}
                      </div>

                      <div className="appointment-actions">
                        <a
                          className="secondary-button"
                          href={getFileUrl(document.file_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open File
                        </a>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => openDeleteDocumentModal(document)}
                          disabled={deletingDocumentId === document.document_id}
                        >
                          {deletingDocumentId === document.document_id
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>X-ray Images</h2>
                  <p>View uploaded X-ray files connected to this record.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/assistant/xrays")}
                >
                  Manage X-rays
                </button>
              </div>

              {loadingXrays ? (
                <p>Loading X-rays...</p>
              ) : xrays.length === 0 ? (
                <div className="empty-state">
                  <h3>No X-rays uploaded</h3>
                  <p>X-ray files will appear here once uploaded.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {xrays.map((xray) => (
                    <div className="appointment-item" key={xray.xray_id}>
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>X-ray #{xray.xray_id}</h3>

                          <span className="status-badge status-scheduled">
                            {xray.tooth_number
                              ? `Tooth #${xray.tooth_number}`
                              : "General"}
                          </span>
                        </div>

                        <p>
                          <strong>Uploaded:</strong>{" "}
                          {formatDate(xray.upload_date)}
                        </p>

                        <p>
                          <strong>File Path:</strong> {xray.file_path}
                        </p>
                      </div>

                      <div className="appointment-actions">
                        <a
                          className="secondary-button"
                          href={getFileUrl(xray.file_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open File
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showToothModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Add Tooth</h3>
                <p>
                  Add a valid FDI tooth number for this{" "}
                  {getRecordDentitionType() === "Child"
                    ? "child / primary"
                    : "adult / permanent"}{" "}
                  dental record.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeToothModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddTooth}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Tooth Number</label>

                <select
                  name="tooth_number"
                  value={toothForm.tooth_number}
                  onChange={handleToothChange}
                  required
                >
                  <option value="">Select Tooth</option>

                  {availableToothNumbers.map((toothNumber) => (
                    <option key={toothNumber} value={toothNumber}>
                      Tooth #{toothNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tooth Status</label>

                <select
                  name="tooth_status"
                  value={toothForm.tooth_status}
                  onChange={handleToothChange}
                >
                  {TOOTH_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Notes / Reason</label>

                <textarea
                  name="notes"
                  value={toothForm.notes}
                  onChange={handleToothChange}
                  placeholder="Example: Existing restoration observed during examination."
                  rows="3"
                />
              </div>

              <div className="info-message">{getToothGuideText()}</div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeToothModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={addingTooth}
                >
                  {addingTooth ? "Adding..." : "Add Tooth"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPdaModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Upload PDA Form</h3>
                <p>
                  Upload a PDA dental chart or form for this patient. This is
                  visible to clinic staff, not required on the patient side.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closePdaModal}
                disabled={uploadingDocument}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handlePdaUpload}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>PDA Form File</label>

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setPdaForm((prev) => ({
                      ...prev,
                      file: e.target.files[0] || null,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes</label>

                <textarea
                  value={pdaForm.notes}
                  onChange={(e) =>
                    setPdaForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Example: PDA form collected and uploaded by dental assistant."
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closePdaModal}
                  disabled={uploadingDocument}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={uploadingDocument}
                >
                  {uploadingDocument ? "Uploading..." : "Upload PDA Form"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOldRecordModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Upload Old / Scanned Record</h3>
                <p>
                  Upload an old dental record, scanned clinic record, or
                  manually encoded source document.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeOldRecordModal}
                disabled={uploadingDocument}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleOldRecordUpload}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Record Type</label>

                <select
                  value={oldRecordForm.document_type}
                  onChange={(e) =>
                    setOldRecordForm((prev) => ({
                      ...prev,
                      document_type: e.target.value,
                    }))
                  }
                >
                  {OLD_RECORD_DOCUMENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Old Record File</label>

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setOldRecordForm((prev) => ({
                      ...prev,
                      file: e.target.files[0] || null,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes</label>

                <textarea
                  value={oldRecordForm.notes}
                  onChange={(e) =>
                    setOldRecordForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Example: Scanned from previous paper-based clinic record."
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeOldRecordModal}
                  disabled={uploadingDocument}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={uploadingDocument}
                >
                  {uploadingDocument ? "Uploading..." : "Upload Old Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteDocumentModal && selectedDocument && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Remove Patient Document</h3>
                <p>
                  Confirm that you want to remove this uploaded document from
                  the dental record.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeDeleteDocumentModal}
                disabled={Boolean(deletingDocumentId)}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleDeleteDocument}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="info-message">
                <strong>Document Type:</strong>{" "}
                {getDocumentTypeLabel(selectedDocument.document_type)}
                <br />
                <strong>File:</strong>{" "}
                {selectedDocument.original_filename || "Uploaded file"}
                <br />
                <strong>Uploaded:</strong>{" "}
                {formatDate(selectedDocument.uploaded_at)}
                <br />
                <strong>Uploaded By:</strong>{" "}
                {selectedDocument.uploaded_by_name || "Unknown"}
              </div>

              <div className="error-message">
                This action will remove the document record and delete the
                uploaded file from the server. This cannot be undone.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeDeleteDocumentModal}
                  disabled={Boolean(deletingDocumentId)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={Boolean(deletingDocumentId)}
                >
                  {deletingDocumentId ? "Removing..." : "Confirm Remove"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTreatmentModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {selectedTreatment ? "Edit Treatment" : "Add Treatment"}
                </h3>

                <p>
                  {selectedTreatment
                    ? "Update the selected treatment or procedure."
                    : "Add a treatment or procedure for a selected tooth."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeTreatmentModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSaveTreatment}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Tooth</label>

                <select
                  name="tooth_id"
                  value={treatmentForm.tooth_id}
                  onChange={handleTreatmentChange}
                  required
                  disabled={Boolean(selectedTreatment)}
                >
                  <option value="">Select Tooth</option>

                  {teeth.map((tooth) => (
                    <option key={tooth.tooth_id} value={tooth.tooth_id}>
                      Tooth #{tooth.tooth_number} -{" "}
                      {normalizeToothStatusLabel(tooth.tooth_status || "Sound")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Procedure Type</label>

                <input
                  type="text"
                  name="procedure_type"
                  value={treatmentForm.procedure_type}
                  onChange={handleTreatmentChange}
                  placeholder="Example: Filling, Cleaning, Extraction"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>

                <textarea
                  name="description"
                  value={treatmentForm.description}
                  onChange={handleTreatmentChange}
                  placeholder="Enter treatment notes or details..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>Treatment Date</label>

                <input
                  type="datetime-local"
                  name="treatment_date"
                  value={treatmentForm.treatment_date}
                  onChange={handleTreatmentChange}
                  required={Boolean(selectedTreatment)}
                />
              </div>

              {selectedTreatment && (
                <div className="info-message">
                  Tooth selection is locked when editing an existing treatment.
                  To move a treatment to another tooth, delete and recreate it
                  under the correct tooth.
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeTreatmentModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingTreatment}
                >
                  {savingTreatment
                    ? "Saving..."
                    : selectedTreatment
                      ? "Save Changes"
                      : "Add Treatment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && selectedHistoryTooth && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Tooth #{selectedHistoryTooth.tooth_number} History</h3>
                <p>View previous status changes for this tooth.</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeHistoryModal}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              {getToothHistory(selectedHistoryTooth.tooth_number).length ===
              0 ? (
                <div className="empty-state">
                  <h3>No history yet</h3>
                  <p>This tooth has no recorded status changes.</p>
                </div>
              ) : (
                <div className="tooth-history-timeline">
                  {getToothHistory(selectedHistoryTooth.tooth_number).map(
                    (history) => (
                      <div
                        className="tooth-history-item"
                        key={history.history_id}
                      >
                        <div className="tooth-history-dot" />

                        <div className="tooth-history-content">
                          <div className="tooth-history-row">
                            <strong>{formatHistoryChange(history)}</strong>

                            <span className="status-badge status-scheduled">
                              {history.change_type || "Status Update"}
                            </span>
                          </div>

                          <p>
                            {history.changed_by_name || "Unknown"}{" "}
                            {history.changed_by_role
                              ? `(${history.changed_by_role})`
                              : ""}{" "}
                            • {formatDate(history.created_at)}
                          </p>

                          {history.notes && (
                            <p className="tooth-history-note">
                              {history.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeHistoryModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReasonModal && pendingTooth && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {reasonMode === "remove"
                    ? "Remove Tooth Status"
                    : "Reason for Tooth Status Change"}
                </h3>

                <p>
                  Add a note so this change is properly documented in the tooth
                  history.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeReasonModal}
                disabled={updatingTooth}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleConfirmReasonAction}>
              {reasonError && (
                <div className="error-message">{reasonError}</div>
              )}

              <div className="info-message">
                <strong>Tooth:</strong> #{pendingTooth.tooth_number}
                <br />
                <strong>Action:</strong>{" "}
                {reasonMode === "remove" ? "Status Removed" : "Status Update"}
                <br />
                <strong>From:</strong>{" "}
                {normalizeToothStatusLabel(pendingTooth.tooth_status)}
                <br />
                <strong>To:</strong>{" "}
                {normalizeToothStatusLabel(
                  reasonMode === "remove" ? "Sound" : pendingStatus,
                )}
              </div>

              <div className="form-group">
                <label>Reason / Notes</label>

                <textarea
                  value={reasonText}
                  onChange={(e) => {
                    setReasonText(e.target.value);
                    setReasonError("");
                  }}
                  placeholder={
                    reasonMode === "remove"
                      ? "Example: Previous status was added incorrectly and verified during examination."
                      : "Example: Restoration was completed during today's visit."
                  }
                  rows="4"
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeReasonModal}
                  disabled={updatingTooth}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    reasonMode === "remove" ? "danger-button" : "primary-button"
                  }
                  disabled={updatingTooth}
                >
                  {updatingTooth
                    ? "Saving..."
                    : reasonMode === "remove"
                      ? "Confirm Remove"
                      : "Confirm Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AssistantDentalRecordDetails;
