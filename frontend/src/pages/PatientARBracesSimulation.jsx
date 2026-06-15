import React, { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";
import "../styles/arBracesSimulation.css";

function PatientARBracesSimulation() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");

  const [cameraOn, setCameraOn] = useState(false);
  const [trackingReady, setTrackingReady] = useState(false);
  const [trackingMode, setTrackingMode] = useState("auto");
  const [faceDetected, setFaceDetected] = useState(false);

  const [savedPreviews, setSavedPreviews] = useState([]);
  const [logsBySimulation, setLogsBySimulation] = useState({});

  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [loadingLogsId, setLoadingLogsId] = useState(null);
  const [loadingTracker, setLoadingTracker] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [manualOverlay, setManualOverlay] = useState({
    x: 50,
    y: 58,
    width: 28,
    height: 10,
    rotation: 0,
    curveDepth: 3,
    openness: 0.12,
  });

  const [trackedOverlay, setTrackedOverlay] = useState({
    x: 50,
    y: 58,
    width: 28,
    height: 10,
    rotation: 0,
    curveDepth: 3,
    openness: 0.12,
  });

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchRecords();
    initializeFaceLandmarker();

    return () => {
      stopTrackingLoop();
      stopCamera();

      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRecordId) {
      fetchSavedPreviewsByRecord(selectedRecordId);
    } else {
      setSavedPreviews([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecordId]);

  useEffect(() => {
    if (cameraOn && trackingMode === "auto" && trackingReady) {
      startTrackingLoop();
    } else {
      stopTrackingLoop();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, trackingMode, trackingReady]);

  const initializeFaceLandmarker = async () => {
    try {
      setLoadingTracker(true);
      setError("");

      console.log("Loading MediaPipe Face Landmarker...");

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.25,
        minFacePresenceConfidence: 0.25,
        minTrackingConfidence: 0.25,
      });

      faceLandmarkerRef.current = faceLandmarker;
      setTrackingReady(true);
      setTrackingMode("auto");

      console.log("MediaPipe Face Landmarker loaded successfully.");
    } catch (err) {
      console.error("Face tracker initialization error:", err);

      setError(
        `Unable to load AR face tracking: ${
          err?.message || "Unknown MediaPipe loading error"
        }. Manual mode is still available.`,
      );

      setTrackingMode("manual");
      setTrackingReady(false);
    } finally {
      setLoadingTracker(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoadingRecords(true);
      setError("");

      const response = await API.get(
        "/api/dental-records/patient/my-records/list",
        authHeaders,
      );

      const patientRecords = response.data.dental_records || [];
      setRecords(patientRecords);

      if (patientRecords.length > 0) {
        setSelectedRecordId(patientRecords[0].record_id);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchSavedPreviewsByRecord = async (recordId) => {
    try {
      setLoadingPreviews(true);
      setError("");

      const response = await API.get(
        `/api/ar-simulations/record/${recordId}`,
        authHeaders,
      );

      setSavedPreviews(response.data.simulations || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load AR previews for this record.",
      );
    } finally {
      setLoadingPreviews(false);
    }
  };

  const fetchSimulationLogs = async (simulationId) => {
    try {
      setLoadingLogsId(simulationId);
      setError("");

      const response = await API.get(
        `/api/ar-simulations/${simulationId}/logs`,
        authHeaders,
      );

      setLogsBySimulation((prev) => ({
        ...prev,
        [simulationId]: response.data.logs || [],
      }));
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load AR simulation history.",
      );
    } finally {
      setLoadingLogsId(null);
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    return `${baseURL}/${filePath}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleString();
  };

  const selectedRecord = records.find(
    (record) => Number(record.record_id) === Number(selectedRecordId),
  );

  const getReviewStatusClass = (status) => {
    switch (status) {
      case "Reviewed":
        return "status-badge status-completed";
      case "For Consultation":
        return "status-badge status-scheduled";
      case "Pending Review":
      default:
        return "status-badge status-pending";
    }
  };

  const getActiveOverlay = () => {
    return trackingMode === "auto" && faceDetected
      ? trackedOverlay
      : manualOverlay;
  };

  const calculateTrackedOverlay = (landmarks) => {
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];

    const upperInnerMid = landmarks[13];
    const lowerInnerMid = landmarks[14];

    const upperInnerLeft = landmarks[78];
    const upperInnerRight = landmarks[308];

    const lowerInnerLeft = landmarks[95];
    const lowerInnerRight = landmarks[324];

    if (
      !leftCorner ||
      !rightCorner ||
      !upperInnerMid ||
      !lowerInnerMid ||
      !upperInnerLeft ||
      !upperInnerRight ||
      !lowerInnerLeft ||
      !lowerInnerRight
    ) {
      return null;
    }

    const mouthCenterX = (leftCorner.x + rightCorner.x) / 2;
    const mouthCenterY = (upperInnerMid.y + lowerInnerMid.y) / 2;

    const dx = rightCorner.x - leftCorner.x;
    const dy = rightCorner.y - leftCorner.y;

    const mouthWidth = Math.sqrt(dx * dx + dy * dy);
    const mouthHeight = Math.abs(lowerInnerMid.y - upperInnerMid.y);

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const upperArcLeft = upperInnerLeft.y;
    const upperArcRight = upperInnerRight.y;
    const upperArcMid = upperInnerMid.y;

    const smileCurve = ((upperArcLeft + upperArcRight) / 2 - upperArcMid) * 100;

    return {
      x: (1 - mouthCenterX) * 100,
      y: mouthCenterY * 100 + 1.5,
      width: Math.max(18, Math.min(42, mouthWidth * 115)),
      height: Math.max(8, Math.min(18, mouthHeight * 140)),
      rotation: -angle,
      curveDepth: Math.max(1.5, Math.min(6, smileCurve * 3.2 + 2.2)),
      openness: mouthHeight / mouthWidth,
    };
  };

  const runFaceTracking = () => {
    const video = videoRef.current;
    const faceLandmarker = faceLandmarkerRef.current;

    if (!video || !faceLandmarker) {
      return;
    }

    if (
      video.readyState >= 2 &&
      video.currentTime !== lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        const results = faceLandmarker.detectForVideo(video, performance.now());
        const landmarks = results.faceLandmarks?.[0];

        if (landmarks) {
          const nextOverlay = calculateTrackedOverlay(landmarks);

          if (nextOverlay) {
            setTrackedOverlay(nextOverlay);
            setFaceDetected(true);
          }
        } else {
          setFaceDetected(false);
        }
      } catch (err) {
        console.error("Face tracking error:", err);
        setFaceDetected(false);
      }
    }

    animationFrameRef.current = requestAnimationFrame(runFaceTracking);
  };

  const startTrackingLoop = () => {
    stopTrackingLoop();
    animationFrameRef.current = requestAnimationFrame(runFaceTracking);
  };

  const stopTrackingLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setFaceDetected(false);
  };

  const startCamera = async () => {
    try {
      setMessage("");
      setError("");
      setFaceDetected(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please allow camera permission.");
    }
  };

  const stopCamera = () => {
    stopTrackingLoop();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
    setFaceDetected(false);
  };

  const switchTrackingMode = (mode) => {
    setTrackingMode(mode);
    setMessage("");
    setError("");

    if (mode === "auto" && !trackingReady) {
      setError(
        "Auto AR tracking is still loading or unavailable. Please use manual mode for now.",
      );
    }

    if (mode === "manual") {
      setFaceDetected(false);
    }
  };

  const resetOverlay = () => {
    setManualOverlay({
      x: 50,
      y: 58,
      width: 28,
      height: 10,
      rotation: 0,
      curveDepth: 3,
      openness: 0.12,
    });

    setTrackedOverlay({
      x: 50,
      y: 58,
      width: 28,
      height: 10,
      rotation: 0,
      curveDepth: 3,
      openness: 0.12,
    });

    setMessage("Overlay controls have been reset.");
    setError("");
  };

  const refreshSimulation = () => {
    resetOverlay();
    fetchRecords();

    if (selectedRecordId) {
      fetchSavedPreviewsByRecord(selectedRecordId);
    }

    setMessage("Simulation view has been refreshed.");
    setError("");
  };

  const drawBraces = (ctx, width, height, curveDepth = 3) => {
    const bracketCount = 8;
    const startX = -width / 2;
    const endX = width / 2;
    const usableWidth = endX - startX;

    const wireGradient = ctx.createLinearGradient(0, -4, 0, 4);
    wireGradient.addColorStop(0, "#ffffff");
    wireGradient.addColorStop(0.4, "#dbe2ea");
    wireGradient.addColorStop(0.75, "#8f9ba8");
    wireGradient.addColorStop(1, "#f8fafc");

    ctx.lineWidth = Math.max(3, height * 0.12);
    ctx.strokeStyle = wireGradient;
    ctx.lineCap = "round";

    ctx.shadowColor = "rgba(15, 23, 42, 0.28)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.moveTo(startX + width * 0.08, 0);
    ctx.quadraticCurveTo(0, curveDepth, endX - width * 0.08, 0);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    for (let i = 0; i < bracketCount; i++) {
      const t = i / (bracketCount - 1);
      const bracketX = startX + width * 0.1 + t * (usableWidth * 0.8);
      const bracketY = Math.sin(t * Math.PI) * (curveDepth * 0.65);

      const bracketWidth = width * 0.075;
      const bracketHeight = height * 0.42;
      const radius = Math.min(bracketWidth, bracketHeight) * 0.22;

      const gradient = ctx.createLinearGradient(
        bracketX - bracketWidth / 2,
        bracketY - bracketHeight / 2,
        bracketX + bracketWidth / 2,
        bracketY + bracketHeight / 2,
      );

      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.45, "#d7dee7");
      gradient.addColorStop(1, "#9ca7b5");

      ctx.fillStyle = gradient;
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;

      ctx.beginPath();

      if (ctx.roundRect) {
        ctx.roundRect(
          bracketX - bracketWidth / 2,
          bracketY - bracketHeight / 2,
          bracketWidth,
          bracketHeight,
          radius,
        );
      } else {
        ctx.rect(
          bracketX - bracketWidth / 2,
          bracketY - bracketHeight / 2,
          bracketWidth,
          bracketHeight,
        );
      }

      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#6b7280";
      ctx.fillRect(
        bracketX - bracketWidth * 0.3,
        bracketY - bracketHeight * 0.08,
        bracketWidth * 0.6,
        bracketHeight * 0.16,
      );

      ctx.strokeStyle = "rgba(191, 219, 254, 0.95)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        bracketX,
        bracketY,
        Math.min(bracketWidth, bracketHeight) * 0.33,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  };

  const dataUrlToFile = async (dataUrl, filename) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    return new File([blob], filename, {
      type: "image/png",
    });
  };

  const savePreviewToBackend = async (imageData) => {
    try {
      setSavingPreview(true);
      setMessage("");
      setError("");

      if (!selectedRecordId) {
        setError("Please select a dental record before saving a preview.");
        return;
      }

      const file = await dataUrlToFile(
        imageData,
        `dentograph-ar-braces-${Date.now()}.png`,
      );

      const formData = new FormData();
      formData.append("simulation", file);
      formData.append("record_id", selectedRecordId);
      formData.append(
        "notes",
        trackingMode === "auto"
          ? "Adaptive face-tracked AR braces simulation preview"
          : "Manual AR braces simulation preview",
      );

      await API.post("/api/ar-simulations", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("AR braces simulation preview saved successfully.");

      if (selectedRecordId) {
        fetchSavedPreviewsByRecord(selectedRecordId);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to save AR simulation preview.",
      );
    } finally {
      setSavingPreview(false);
    }
  };

  const captureSimulation = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    setMessage("");
    setError("");

    if (!selectedRecordId) {
      setError("Please select a dental record before capturing a preview.");
      return;
    }

    if (!cameraOn) {
      setError("Please start the camera before capturing a preview.");
      return;
    }

    if (trackingMode === "auto" && !faceDetected) {
      setError(
        "No face detected. Please center your full face in the frame or switch to manual mode.",
      );
      return;
    }

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet. Please try again.");
      return;
    }

    const activeOverlay = getActiveOverlay();

    const width = video.videoWidth;
    const height = video.videoHeight;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    const bracesWidth = (activeOverlay.width / 100) * width;
    const bracesHeight = (activeOverlay.height / 100) * height;

    const x = (activeOverlay.x / 100) * width;
    const y = (activeOverlay.y / 100) * height;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((activeOverlay.rotation * Math.PI) / 180);
    drawBraces(ctx, bracesWidth, bracesHeight, activeOverlay.curveDepth || 3);
    ctx.restore();

    const imageData = canvas.toDataURL("image/png");

    savePreviewToBackend(imageData);
  };

  const deletePreview = async (simulationId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this saved preview?",
    );

    if (!confirmDelete) return;

    try {
      setMessage("");
      setError("");

      await API.delete(`/api/ar-simulations/${simulationId}`, authHeaders);

      setMessage("Saved preview has been deleted.");

      if (selectedRecordId) {
        fetchSavedPreviewsByRecord(selectedRecordId);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete saved preview.");
    }
  };

  const clearAllPreviews = async () => {
    if (savedPreviews.length === 0) return;

    const confirmClear = window.confirm(
      "Are you sure you want to delete all saved previews for this record?",
    );

    if (!confirmClear) return;

    try {
      setMessage("");
      setError("");

      await Promise.all(
        savedPreviews.map((preview) =>
          API.delete(
            `/api/ar-simulations/${preview.simulation_id}`,
            authHeaders,
          ),
        ),
      );

      setMessage("All saved previews for this record have been deleted.");

      if (selectedRecordId) {
        fetchSavedPreviewsByRecord(selectedRecordId);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to clear saved previews.");
    }
  };

  const activeOverlay = getActiveOverlay();

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>AR Braces Simulation</h2>
          <p>
            Use real-time face tracking to preview adaptive braces that follow
            the visible mouth and teeth area.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <div className="appointment-form">
            <div className="form-group">
              <label>Dental Record</label>
              <select
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                disabled={loadingRecords || savingPreview}
              >
                <option value="">Select Dental Record</option>
                {records.map((record) => (
                  <option key={record.record_id} value={record.record_id}>
                    Record #{record.record_id} -{" "}
                    {record.dentist_name || `Dentist ID ${record.dentist_id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>AR Mode</label>
              <select
                value={trackingMode}
                onChange={(e) => switchTrackingMode(e.target.value)}
                disabled={savingPreview}
              >
                <option value="auto">
                  Auto AR Tracking {loadingTracker ? "(Loading...)" : ""}
                </option>
                <option value="manual">Manual Fine-Tuning</option>
              </select>
            </div>

            {trackingMode === "manual" && (
              <>
                <div className="form-group">
                  <label>Horizontal Position</label>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    value={manualOverlay.x}
                    onChange={(e) =>
                      setManualOverlay({
                        ...manualOverlay,
                        x: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Vertical Position</label>
                  <input
                    type="range"
                    min="35"
                    max="80"
                    value={manualOverlay.y}
                    onChange={(e) =>
                      setManualOverlay({
                        ...manualOverlay,
                        y: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Overlay Width</label>
                  <input
                    type="range"
                    min="18"
                    max="45"
                    step="1"
                    value={manualOverlay.width}
                    onChange={(e) =>
                      setManualOverlay({
                        ...manualOverlay,
                        width: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Overlay Height</label>
                  <input
                    type="range"
                    min="8"
                    max="20"
                    step="1"
                    value={manualOverlay.height}
                    onChange={(e) =>
                      setManualOverlay({
                        ...manualOverlay,
                        height: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Smile Curve</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.2"
                    value={manualOverlay.curveDepth}
                    onChange={(e) =>
                      setManualOverlay({
                        ...manualOverlay,
                        curveDepth: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Rotation</label>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    value={manualOverlay.rotation}
                    onChange={(e) =>
                      setManualOverlay({
                        ...manualOverlay,
                        rotation: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </>
            )}

            <button
              type="button"
              className="secondary-button"
              onClick={refreshSimulation}
              disabled={loadingRecords || loadingPreviews || savingPreview}
            >
              {loadingRecords || loadingPreviews
                ? "Refreshing..."
                : "Reset Simulation"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/patient/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>

          <div className="info-message" style={{ marginTop: "18px" }}>
            Auto AR Tracking uses lip and mouth landmarks to estimate the
            visible teeth area. This is for visualization only and not a final
            orthodontic diagnosis.
          </div>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Live AR Filter Preview</h2>
              <p>
                Start the camera. In auto mode, the braces adapt to the mouth
                area and follow your face in real time.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={refreshSimulation}
              type="button"
              disabled={loadingRecords || loadingPreviews || savingPreview}
            >
              {loadingRecords || loadingPreviews ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {selectedRecord && (
            <div className="appointment-item" style={{ marginBottom: "18px" }}>
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Selected Record #{selectedRecord.record_id}</h3>

                  <span className="status-badge status-scheduled">
                    {selectedRecord.status || "Active"}
                  </span>
                </div>

                <p>
                  <strong>Dentist:</strong>{" "}
                  {selectedRecord.dentist_name ||
                    `Dentist ID ${selectedRecord.dentist_id}`}
                </p>

                <p>
                  <strong>Clinic:</strong>{" "}
                  {selectedRecord.clinic_name || "No assigned clinic"}
                </p>
              </div>
            </div>
          )}

          <div className="appointment-item" style={{ marginBottom: "18px" }}>
            <div className="appointment-info">
              <div className="appointment-title-row">
                <h3>Simulation Status</h3>

                <span
                  className={
                    cameraOn
                      ? "status-badge status-completed"
                      : "status-badge status-pending"
                  }
                >
                  {cameraOn ? "Camera Active" : "Camera Off"}
                </span>

                {trackingMode === "auto" && (
                  <span
                    className={
                      faceDetected
                        ? "status-badge status-completed"
                        : "status-badge status-pending"
                    }
                  >
                    {faceDetected ? "Face Tracking" : "No Face Detected"}
                  </span>
                )}
              </div>

              <p>
                <strong>Mode:</strong>{" "}
                {trackingMode === "auto"
                  ? "Auto AR Tracking"
                  : "Manual Fine-Tuning"}
              </p>

              <p>
                <strong>Tracker:</strong>{" "}
                {trackingReady
                  ? "Ready"
                  : loadingTracker
                    ? "Loading MediaPipe..."
                    : "Unavailable - check console"}
              </p>
            </div>

            <div className="appointment-actions">
              {!cameraOn ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={startCamera}
                  disabled={savingPreview || !selectedRecordId}
                >
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={stopCamera}
                  disabled={savingPreview}
                >
                  Stop Camera
                </button>
              )}

              <button
                type="button"
                className="primary-button"
                onClick={captureSimulation}
                disabled={!cameraOn || savingPreview || !selectedRecordId}
              >
                {savingPreview ? "Saving..." : "Capture"}
              </button>
            </div>
          </div>

          <div className="xray-annotation-viewer ar-viewer-card">
            <div className="ar-camera-frame ar-xray-style-frame">
              {!cameraOn && (
                <div className="ar-camera-placeholder">
                  <div className="ar-placeholder-icon">DG</div>
                  <h3>Camera Preview</h3>
                  <p>
                    Start the camera to display the adaptive AR braces filter.
                  </p>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={
                  cameraOn ? "ar-camera-video active" : "ar-camera-video"
                }
              />

              {cameraOn && (
                <div
                  className="ar-braces-overlay adaptive"
                  style={{
                    left: `${activeOverlay.x}%`,
                    top: `${activeOverlay.y}%`,
                    width: `${activeOverlay.width}%`,
                    height: `${activeOverlay.height}%`,
                    transform: `translate(-50%, -50%) rotate(${activeOverlay.rotation}deg)`,
                    opacity:
                      trackingMode === "manual" || faceDetected ? 1 : 0.35,
                  }}
                >
                  <svg
                    className="ar-braces-svg"
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="wireGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="40%" stopColor="#dbe2ea" />
                        <stop offset="75%" stopColor="#8f9ba8" />
                        <stop offset="100%" stopColor="#f8fafc" />
                      </linearGradient>

                      <linearGradient
                        id="bracketGrad"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="45%" stopColor="#d7dee7" />
                        <stop offset="100%" stopColor="#9ca7b5" />
                      </linearGradient>
                    </defs>

                    <path
                      d={`M 8 22 Q 50 ${22 + activeOverlay.curveDepth} 92 22`}
                      stroke="url(#wireGrad)"
                      strokeWidth="2.8"
                      fill="none"
                      strokeLinecap="round"
                    />

                    {Array.from({ length: 8 }).map((_, index) => {
                      const t = index / 7;
                      const x = 10 + t * 80;
                      const y =
                        22 +
                        Math.sin(t * Math.PI) * activeOverlay.curveDepth * 0.65;

                      return (
                        <g key={index} transform={`translate(${x}, ${y})`}>
                          <rect
                            x="-4.2"
                            y="-4.2"
                            width="8.4"
                            height="8.4"
                            rx="1.5"
                            fill="url(#bracketGrad)"
                            stroke="#64748b"
                            strokeWidth="0.6"
                          />

                          <rect
                            x="-2.6"
                            y="-0.7"
                            width="5.2"
                            height="1.4"
                            rx="0.7"
                            fill="#6b7280"
                          />

                          <circle
                            cx="0"
                            cy="0"
                            r="3.2"
                            fill="none"
                            stroke="rgba(191,219,254,0.95)"
                            strokeWidth="0.7"
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {cameraOn && trackingMode === "auto" && !faceDetected && (
                <div className="ar-tracking-warning">
                  Center your full face in the frame
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden-canvas" />

            <p className="xray-helper-text">
              Tip: Smile slightly and keep your full face visible. The braces
              will fit better when the mouth area is clearly visible.
            </p>
          </div>

          <div className="appointments-header" style={{ marginTop: "28px" }}>
            <div>
              <h2>Saved Previews</h2>
              <p>
                Captured previews for the selected dental record will appear
                here.
              </p>
            </div>

            <button
              type="button"
              className="danger-button"
              onClick={clearAllPreviews}
              disabled={
                savedPreviews.length === 0 || loadingPreviews || savingPreview
              }
            >
              Clear All
            </button>
          </div>

          {loadingRecords ? (
            <p>Loading dental records...</p>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records yet</h3>
              <p>
                Your AR braces simulations can be saved once a dental record is
                created.
              </p>
            </div>
          ) : loadingPreviews ? (
            <p>Loading saved previews...</p>
          ) : savedPreviews.length === 0 ? (
            <div className="empty-state">
              <h3>No saved previews for this record</h3>
              <p>
                Capture an AR braces simulation preview and it will appear here.
              </p>
            </div>
          ) : (
            <div className="appointments-list">
              {savedPreviews.map((preview) => {
                const logs = logsBySimulation[preview.simulation_id] || [];

                return (
                  <div className="appointment-item" key={preview.simulation_id}>
                    <div className="appointment-info">
                      <div className="appointment-title-row">
                        <h3>Preview #{preview.simulation_id}</h3>

                        <span
                          className={getReviewStatusClass(
                            preview.review_status || "Pending Review",
                          )}
                        >
                          {preview.review_status || "Pending Review"}
                        </span>
                      </div>

                      <div className="ar-saved-preview">
                        <img
                          src={getFileUrl(preview.image_path)}
                          alt={`Saved AR braces preview ${preview.simulation_id}`}
                        />
                      </div>

                      <p>
                        <strong>Record ID:</strong> {preview.record_id}
                      </p>

                      <p>
                        <strong>Captured:</strong>{" "}
                        {formatDate(preview.created_at)}
                      </p>

                      <p>
                        <strong>Type:</strong> AR Braces Simulation
                      </p>

                      <p>
                        <strong>Dentist Review:</strong>{" "}
                        {preview.review_status || "Pending Review"}
                      </p>

                      {preview.dentist_notes ? (
                        <p>
                          <strong>Dentist Notes:</strong>{" "}
                          {preview.dentist_notes}
                        </p>
                      ) : (
                        <p>
                          <strong>Dentist Notes:</strong> Not reviewed yet
                        </p>
                      )}

                      <p>
                        <strong>Reviewed At:</strong>{" "}
                        {formatDate(preview.reviewed_at)}
                      </p>

                      {preview.notes && (
                        <p>
                          <strong>Patient Notes:</strong> {preview.notes}
                        </p>
                      )}

                      <div className="ar-log-section">
                        <div className="appointments-header">
                          <div>
                            <h3>Activity History</h3>
                            <p>
                              View the progress of this AR simulation preview.
                            </p>
                          </div>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              fetchSimulationLogs(preview.simulation_id)
                            }
                            disabled={loadingLogsId === preview.simulation_id}
                          >
                            {loadingLogsId === preview.simulation_id
                              ? "Loading..."
                              : "View History"}
                          </button>
                        </div>

                        {logs.length > 0 && (
                          <div className="annotation-list">
                            {logs.map((log) => (
                              <div className="annotation-card" key={log.log_id}>
                                <h3>{log.action}</h3>

                                <p>
                                  <strong>By:</strong>{" "}
                                  {log.user_name || "System"}{" "}
                                  {log.user_role ? `(${log.user_role})` : ""}
                                </p>

                                <p>
                                  <strong>Date:</strong>{" "}
                                  {formatDate(log.created_at)}
                                </p>

                                {log.details && (
                                  <p>
                                    <strong>Details:</strong> {log.details}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="appointment-actions">
                      <a
                        className="secondary-button"
                        href={getFileUrl(preview.image_path)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>

                      <a
                        className="secondary-button"
                        href={getFileUrl(preview.image_path)}
                        download={`dentograph-ar-braces-preview-${preview.simulation_id}.png`}
                      >
                        Download
                      </a>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => deletePreview(preview.simulation_id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PatientARBracesSimulation;
