import React, { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";
import "../styles/arBracesSimulation.css";

const BRACE_STYLE_OPTIONS = [
  {
    value: "metal",
    label: "Metal",
    description: "Classic silver braces",
    color: "#94a3b8",
  },
  {
    value: "ceramic",
    label: "Ceramic",
    description: "Subtle tooth-colored look",
    color: "#f8ead3",
  },
  {
    value: "blue",
    label: "Blue",
    description: "Blue colored ligatures",
    color: "#38bdf8",
  },
  {
    value: "pink",
    label: "Pink",
    description: "Pink colored ligatures",
    color: "#f472b6",
  },
  {
    value: "green",
    label: "Green",
    description: "Green colored ligatures",
    color: "#4ade80",
  },
  {
    value: "purple",
    label: "Purple",
    description: "Purple colored ligatures",
    color: "#a78bfa",
  },
];

function PatientARBracesSimulation() {
  const navigate = useNavigate();
  const isMobileEmbed =
    new URLSearchParams(window.location.search).get("embed") === "mobile";

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const braceStyleRef = useRef("metal");

  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");

  const [cameraOn, setCameraOn] = useState(false);
  const [trackingReady, setTrackingReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  const [savedPreviews, setSavedPreviews] = useState([]);
  const [logsBySimulation, setLogsBySimulation] = useState({});

  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [loadingLogsId, setLoadingLogsId] = useState(null);
  const [loadingTracker, setLoadingTracker] = useState(false);

  const [snapshotPreview, setSnapshotPreview] = useState("");
  const [operationProgress, setOperationProgress] = useState({
    active: false,
    percent: 0,
    label: "",
    detail: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [braceStyle, setBraceStyle] = useState("metal");

  const AUTO_FIT = {
    yOffset: -2,
    widthScale: 0.84,
    lowerWidthScale: 0.78,
    heightScale: 1,
    bracketScale: 1.05,

    closedUpperRowFactor: -0.18,
    closedLowerRowFactor: 0.23,

    openUpperRowFactor: -0.46,
    openLowerRowFactor: 0.48,

    upperCurveFactor: 0.055,
    lowerCurveFactor: 0.05,
    upperBracketCount: 8,
    lowerBracketCount: 8,
  };

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
    if (cameraOn && trackingReady) {
      startTrackingLoop();
    } else {
      stopTrackingLoop();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, trackingReady]);

  useEffect(() => {
    braceStyleRef.current = braceStyle;

    if (cameraOn && latestLandmarksRef.current && overlayCanvasRef.current) {
      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBracesOnCanvas(ctx, canvas, latestLandmarksRef.current);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [braceStyle]);

  const updateOperationProgress = (
    percent,
    label,
    detail = "",
    active = true,
  ) => {
    setOperationProgress({
      active,
      percent: Math.max(0, Math.min(100, Number(percent) || 0)),
      label,
      detail,
    });
  };

  const finishOperationProgress = (label, detail = "") => {
    updateOperationProgress(100, label, detail, true);

    window.setTimeout(() => {
      setOperationProgress((current) => {
        if (current.percent !== 100) return current;

        return {
          active: false,
          percent: 0,
          label: "",
          detail: "",
        };
      });
    }, 1200);
  };

  const initializeFaceLandmarker = async () => {
    try {
      setLoadingTracker(true);
      setError("");
      updateOperationProgress(
        10,
        "Preparing AR tracker",
        "Loading the MediaPipe runtime...",
      );

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );

      updateOperationProgress(
        45,
        "Preparing AR tracker",
        "MediaPipe runtime loaded. Loading the face landmark model...",
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

      updateOperationProgress(
        90,
        "Preparing AR tracker",
        "Finalizing face tracking...",
      );

      faceLandmarkerRef.current = faceLandmarker;
      setTrackingReady(true);
      finishOperationProgress(
        "AR tracker ready",
        "Face tracking is ready. You may start the camera.",
      );
    } catch (err) {
      console.error("Face tracker initialization error:", err);

      setError(
        `Unable to load AR face tracking: ${err?.message || "Unknown MediaPipe loading error"
        }. Please refresh and try again.`,
      );

      setTrackingReady(false);
      setOperationProgress({
        active: false,
        percent: 0,
        label: "",
        detail: "",
      });
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

    if (filePath.startsWith("http")) {
      return filePath;
    }

    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

    return `${baseURL}/${cleanPath}`;
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

  const getBraceStyleLabel = () => {
    const currentStyle = braceStyleRef.current || braceStyle;

    switch (currentStyle) {
      case "ceramic":
        return "Ceramic Braces";
      case "blue":
        return "Blue Ligatures";
      case "pink":
        return "Pink Ligatures";
      case "green":
        return "Green Ligatures";
      case "purple":
        return "Purple Ligatures";
      case "metal":
      default:
        return "Metal Braces";
    }
  };

  const getBraceStyleLabelFromValue = (styleValue) => {
    switch (styleValue) {
      case "ceramic":
        return "Ceramic Braces";
      case "blue":
        return "Blue Ligatures";
      case "pink":
        return "Pink Ligatures";
      case "green":
        return "Green Ligatures";
      case "purple":
        return "Purple Ligatures";
      case "metal":
      default:
        return "Metal Braces";
    }
  };

  const getBraceStyleConfig = () => {
    const currentStyle = braceStyleRef.current || braceStyle;

    switch (currentStyle) {
      case "ceramic":
        return {
          bracketLight: "#fffaf0",
          bracketMid: "#f8ead3",
          bracketDark: "#d6b98c",
          border: "rgba(120, 86, 45, 0.75)",
          slot: "#8b7355",
          ring: "rgba(255, 248, 220, 0.95)",
          wireLight: "#ffffff",
          wireMid: "#e5e7eb",
          wireDark: "#9ca3af",
        };

      case "blue":
        return {
          bracketLight: "#ffffff",
          bracketMid: "#dbeafe",
          bracketDark: "#64748b",
          border: "rgba(30, 41, 59, 0.9)",
          slot: "#1e3a8a",
          ring: "#38bdf8",
          wireLight: "#ffffff",
          wireMid: "#dbeafe",
          wireDark: "#64748b",
        };

      case "pink":
        return {
          bracketLight: "#ffffff",
          bracketMid: "#fce7f3",
          bracketDark: "#94a3b8",
          border: "rgba(30, 41, 59, 0.9)",
          slot: "#831843",
          ring: "#f472b6",
          wireLight: "#ffffff",
          wireMid: "#fce7f3",
          wireDark: "#94a3b8",
        };

      case "green":
        return {
          bracketLight: "#ffffff",
          bracketMid: "#dcfce7",
          bracketDark: "#94a3b8",
          border: "rgba(30, 41, 59, 0.9)",
          slot: "#14532d",
          ring: "#4ade80",
          wireLight: "#ffffff",
          wireMid: "#dcfce7",
          wireDark: "#94a3b8",
        };

      case "purple":
        return {
          bracketLight: "#ffffff",
          bracketMid: "#ede9fe",
          bracketDark: "#94a3b8",
          border: "rgba(30, 41, 59, 0.9)",
          slot: "#4c1d95",
          ring: "#a78bfa",
          wireLight: "#ffffff",
          wireMid: "#ede9fe",
          wireDark: "#94a3b8",
        };

      case "metal":
      default:
        return {
          bracketLight: "#ffffff",
          bracketMid: "#cbd5e1",
          bracketDark: "#64748b",
          border: "rgba(30, 41, 59, 0.88)",
          slot: "#334155",
          ring: "rgba(219, 234, 254, 0.95)",
          wireLight: "#ffffff",
          wireMid: "#e5e7eb",
          wireDark: "#94a3b8",
        };
    }
  };

  const getCanvasPoint = (landmark, canvas) => {
    return {
      x: (1 - landmark.x) * canvas.width,
      y: landmark.y * canvas.height,
    };
  };

  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();

    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
    }
  };

  const drawRealisticBracket = (ctx, x, y, size, rotation = 0) => {
    const style = getBraceStyleConfig();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const bracketWidth = size;
    const bracketHeight = size * 0.78;

    const gradient = ctx.createLinearGradient(
      -bracketWidth / 2,
      -bracketHeight / 2,
      bracketWidth / 2,
      bracketHeight / 2,
    );

    gradient.addColorStop(0, style.bracketLight);
    gradient.addColorStop(0.32, "#f8fafc");
    gradient.addColorStop(0.68, style.bracketMid);
    gradient.addColorStop(1, style.bracketDark);

    ctx.shadowColor = "rgba(15, 23, 42, 0.24)";
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.06;

    ctx.fillStyle = gradient;
    ctx.strokeStyle = style.border;
    ctx.lineWidth = Math.max(0.8, size * 0.055);

    drawRoundedRect(
      ctx,
      -bracketWidth / 2,
      -bracketHeight / 2,
      bracketWidth,
      bracketHeight,
      size * 0.16,
    );

    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = style.slot;
    ctx.fillRect(
      -bracketWidth * 0.3,
      -bracketHeight * 0.08,
      bracketWidth * 0.6,
      bracketHeight * 0.16,
    );

    ctx.strokeStyle = style.ring;
    ctx.lineWidth = Math.max(0.8, size * 0.055);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.23, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(-size * 0.16, -size * 0.14, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const getBracketPositions = (rowWidth, count) => {
    const startX = -rowWidth / 2;
    const step = rowWidth / (count - 1);

    return Array.from({ length: count }, (_, index) => startX + step * index);
  };

  const drawBracesRow = ({
    ctx,
    rowY,
    rowWidth,
    bracketCount,
    bracketSize,
    curve,
    isUpper,
    wireGradient,
  }) => {
    const xs = getBracketPositions(rowWidth, bracketCount);

    ctx.strokeStyle = wireGradient;
    ctx.lineWidth = Math.max(1.5, bracketSize * 0.17);
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(15, 23, 42, 0.2)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();

    if (isUpper) {
      ctx.moveTo(xs[0], rowY);
      ctx.quadraticCurveTo(0, rowY + curve, xs[xs.length - 1], rowY);
    } else {
      ctx.moveTo(xs[0], rowY);
      ctx.quadraticCurveTo(0, rowY - curve, xs[xs.length - 1], rowY);
    }

    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    xs.forEach((x, index) => {
      const t = index / (xs.length - 1);
      const curveY = Math.sin(t * Math.PI) * curve;
      const y = isUpper ? rowY + curveY : rowY - curveY;

      drawRealisticBracket(ctx, x, y, bracketSize, 0);
    });
  };

  const drawBracesOnCanvas = (ctx, canvas, landmarks) => {
    if (!landmarks) return;

    const requiredLandmarks = [61, 291, 13, 14, 78, 308, 95, 324];

    const hasRequiredLandmarks = requiredLandmarks.every(
      (index) => landmarks[index],
    );

    if (!hasRequiredLandmarks) return;

    const leftCorner = getCanvasPoint(landmarks[61], canvas);
    const rightCorner = getCanvasPoint(landmarks[291], canvas);

    const upperLip = getCanvasPoint(landmarks[13], canvas);
    const lowerLip = getCanvasPoint(landmarks[14], canvas);

    const upperLeft = getCanvasPoint(landmarks[78], canvas);
    const upperRight = getCanvasPoint(landmarks[308], canvas);

    const lowerLeft = getCanvasPoint(landmarks[95], canvas);
    const lowerRight = getCanvasPoint(landmarks[324], canvas);

    const mouthWidth = Math.hypot(
      rightCorner.x - leftCorner.x,
      rightCorner.y - leftCorner.y,
    );

    const mouthHeight = Math.abs(lowerLip.y - upperLip.y);

    if (mouthWidth < 42 || mouthHeight < 5) return;

    const centerX = (leftCorner.x + rightCorner.x) / 2;
    const centerY = (upperLip.y + lowerLip.y) / 2 + AUTO_FIT.yOffset;

    const angle = Math.atan2(
      rightCorner.y - leftCorner.y,
      rightCorner.x - leftCorner.x,
    );

    const rowWidth = mouthWidth * AUTO_FIT.widthScale;
    const upperRowWidth = rowWidth;
    const lowerRowWidth = rowWidth * AUTO_FIT.lowerWidthScale;

    const upperBracketSize =
      Math.max(6.8, Math.min(13.8, mouthWidth * 0.058)) * AUTO_FIT.bracketScale;

    const lowerBracketSize =
      Math.max(6.3, Math.min(13.2, mouthWidth * 0.054)) * AUTO_FIT.bracketScale;

    const mouthOpenRatio = mouthHeight / mouthWidth;

    const openness = Math.min(Math.max((mouthOpenRatio - 0.28) / 0.28, 0), 1);

    const upperFactor =
      AUTO_FIT.closedUpperRowFactor +
      (AUTO_FIT.openUpperRowFactor - AUTO_FIT.closedUpperRowFactor) * openness;

    const lowerFactor =
      AUTO_FIT.closedLowerRowFactor +
      (AUTO_FIT.openLowerRowFactor - AUTO_FIT.closedLowerRowFactor) * openness;

    const scaledHeight = mouthHeight * AUTO_FIT.heightScale;

    const upperRowY = scaledHeight * upperFactor;
    const lowerRowY = scaledHeight * lowerFactor;

    const upperCurve = Math.max(1.4, mouthHeight * AUTO_FIT.upperCurveFactor);
    const lowerCurve = Math.max(1.2, mouthHeight * AUTO_FIT.lowerCurveFactor);

    const style = getBraceStyleConfig();

    const wireGradient = ctx.createLinearGradient(0, -5, 0, 5);
    wireGradient.addColorStop(0, style.wireLight);
    wireGradient.addColorStop(0.36, style.wireMid);
    wireGradient.addColorStop(0.75, style.wireDark);
    wireGradient.addColorStop(1, "#f8fafc");

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(
      upperLeft.x - mouthWidth * 0.035,
      upperLeft.y - mouthHeight * 0.12,
    );
    ctx.quadraticCurveTo(
      upperLip.x,
      upperLip.y - mouthHeight * 0.28,
      upperRight.x + mouthWidth * 0.035,
      upperRight.y - mouthHeight * 0.12,
    );
    ctx.lineTo(
      lowerRight.x + mouthWidth * 0.035,
      lowerRight.y + mouthHeight * 0.12,
    );
    ctx.quadraticCurveTo(
      lowerLip.x,
      lowerLip.y + mouthHeight * 0.28,
      lowerLeft.x - mouthWidth * 0.035,
      lowerLeft.y + mouthHeight * 0.12,
    );
    ctx.closePath();
    ctx.clip();

    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    if (AUTO_FIT.upperBracketCount > 0) {
      drawBracesRow({
        ctx,
        rowY: upperRowY,
        rowWidth: upperRowWidth,
        bracketCount: AUTO_FIT.upperBracketCount,
        bracketSize: upperBracketSize,
        curve: upperCurve,
        isUpper: true,
        wireGradient,
      });
    }

    if (AUTO_FIT.lowerBracketCount > 0) {
      drawBracesRow({
        ctx,
        rowY: lowerRowY,
        rowWidth: lowerRowWidth,
        bracketCount: AUTO_FIT.lowerBracketCount,
        bracketSize: lowerBracketSize,
        curve: lowerCurve,
        isUpper: false,
        wireGradient,
      });
    }

    ctx.restore();
  };

  const runFaceTracking = () => {
    const video = videoRef.current;
    const faceLandmarker = faceLandmarkerRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (!video || !faceLandmarker || !overlayCanvas) {
      return;
    }

    const rect = video.getBoundingClientRect();

    overlayCanvas.width = rect.width;
    overlayCanvas.height = rect.height;

    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (
      video.readyState >= 2 &&
      video.currentTime !== lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        const results = faceLandmarker.detectForVideo(video, performance.now());
        const landmarks = results.faceLandmarks?.[0];

        if (landmarks) {
          latestLandmarksRef.current = landmarks;
          setFaceDetected(true);
          drawBracesOnCanvas(ctx, overlayCanvas, landmarks);
        } else {
          latestLandmarksRef.current = null;
          setFaceDetected(false);
        }
      } catch (err) {
        console.error("Face tracking error:", err);
        latestLandmarksRef.current = null;
        setFaceDetected(false);
      }
    } else if (latestLandmarksRef.current) {
      drawBracesOnCanvas(ctx, overlayCanvas, latestLandmarksRef.current);
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

    latestLandmarksRef.current = null;
    setFaceDetected(false);

    const overlayCanvas = overlayCanvasRef.current;

    if (overlayCanvas) {
      const ctx = overlayCanvas.getContext("2d");
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  };

  const startCamera = async () => {
    try {
      setMessage("");
      setError("");
      setFaceDetected(false);

      updateOperationProgress(
        12,
        "Starting camera",
        "Waiting for camera permission...",
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      updateOperationProgress(
        58,
        "Starting camera",
        "Camera permission granted. Preparing the video feed...",
      );

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        updateOperationProgress(
          88,
          "Starting camera",
          "Connecting the camera feed to face tracking...",
        );

        setCameraOn(true);
        finishOperationProgress(
          "Camera ready",
          "Center your face in the frame and smile slightly.",
        );
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please allow camera permission.");
      setOperationProgress({
        active: false,
        percent: 0,
        label: "",
        detail: "",
      });
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

  const resetSimulation = () => {
    fetchRecords();

    if (selectedRecordId) {
      fetchSavedPreviewsByRecord(selectedRecordId);
    }

    setMessage("Simulation view has been refreshed.");
    setError("");
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
        setOperationProgress({
          active: false,
          percent: 0,
          label: "",
          detail: "",
        });
        return;
      }

      updateOperationProgress(
        68,
        "Saving snapshot",
        "Preparing the captured image for upload...",
      );

      const file = await dataUrlToFile(
        imageData,
        `dentograph-ar-braces-${Date.now()}.png`,
      );

      const formData = new FormData();

      formData.append("simulation", file);
      formData.append("record_id", selectedRecordId);
      formData.append("brace_style", braceStyleRef.current || braceStyle);
      formData.append(
        "notes",
        "Auto-fitted face-tracked AR braces simulation preview",
      );

      await API.post("/api/ar-simulations", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size || 1;
          const uploadedPercent = Math.round(
            (progressEvent.loaded / total) * 100,
          );
          const overallPercent = 70 + Math.round(uploadedPercent * 0.28);

          updateOperationProgress(
            Math.min(98, overallPercent),
            "Saving snapshot",
            `Uploading snapshot... ${Math.min(100, uploadedPercent)}%`,
          );
        },
      });

      setMessage("AR braces snapshot captured and saved successfully.");
      finishOperationProgress(
        "Snapshot saved",
        "The captured AR preview is now available under Saved Previews.",
      );

      if (selectedRecordId) {
        fetchSavedPreviewsByRecord(selectedRecordId);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to save AR simulation preview.",
      );
      setOperationProgress({
        active: false,
        percent: 0,
        label: "",
        detail: "",
      });
    } finally {
      setSavingPreview(false);
    }
  };

  const captureSimulation = async () => {
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

    if (!latestLandmarksRef.current) {
      setError("No face detected. Please center your full face in the frame.");
      return;
    }

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet. Please try again.");
      return;
    }

    try {
      updateOperationProgress(
        12,
        "Capturing snapshot",
        "Freezing the current camera frame...",
      );

      const width = video.videoWidth;
      const height = video.videoHeight;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Unable to prepare the snapshot canvas.");
      }

      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();

      updateOperationProgress(
        38,
        "Capturing snapshot",
        "Applying the selected braces style...",
      );

      drawBracesOnCanvas(ctx, canvas, latestLandmarksRef.current);

      updateOperationProgress(
        58,
        "Capturing snapshot",
        "Encoding the final preview image...",
      );

      const imageData = canvas.toDataURL("image/png");
      setSnapshotPreview(imageData);

      await savePreviewToBackend(imageData);
    } catch (err) {
      console.error("Snapshot capture error:", err);
      setError(err.message || "Unable to capture the AR braces snapshot.");
      setOperationProgress({
        active: false,
        percent: 0,
        label: "",
        detail: "",
      });
    }
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

  return (
    <DashboardLayout role="Patient" embedded={isMobileEmbed}>
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>AR Braces Simulation</h2>
          <p>
            Use real-time face tracking to preview braces fitted to the visible
            teeth area.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          {operationProgress.active && (
            <div
              className="ar-operation-progress"
              role="status"
              aria-live="polite"
              aria-label={`${operationProgress.label}: ${operationProgress.percent}%`}
            >
              <div className="ar-operation-progress-header">
                <strong>{operationProgress.label}</strong>
                <span>{operationProgress.percent}%</span>
              </div>

              <div className="ar-operation-progress-track" aria-hidden="true">
                <div
                  className="ar-operation-progress-fill"
                  style={{ width: `${operationProgress.percent}%` }}
                />
              </div>

              {operationProgress.detail && <p>{operationProgress.detail}</p>}
            </div>
          )}

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
              <label>Braces Style</label>

              <div className="brace-style-grid">
                {BRACE_STYLE_OPTIONS.map((style) => {
                  const isSelected = braceStyle === style.value;

                  return (
                    <button
                      key={style.value}
                      type="button"
                      className={
                        isSelected
                          ? "brace-style-card selected"
                          : "brace-style-card"
                      }
                      onClick={() => {
                        braceStyleRef.current = style.value;
                        setBraceStyle(style.value);
                      }}
                      disabled={savingPreview}
                    >
                      <span
                        className="brace-style-color"
                        style={{ backgroundColor: style.color }}
                      />

                      <span className="brace-style-text">
                        <strong>{style.label}</strong>
                        <small>{style.description}</small>
                      </span>

                      {isSelected && (
                        <span className="brace-style-check">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={resetSimulation}
              disabled={loadingRecords || loadingPreviews || savingPreview}
            >
              {loadingRecords || loadingPreviews
                ? "Refreshing..."
                : "Refresh Simulation"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/patient/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Live AR Filter Preview</h2>
              <p>
                Start the camera. The braces will automatically follow the mouth
                and sit across the visible teeth area.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={resetSimulation}
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

                <p>
                  <strong>Selected Style:</strong> {getBraceStyleLabel()}
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

                <span
                  className={
                    faceDetected
                      ? "status-badge status-completed"
                      : "status-badge status-pending"
                  }
                >
                  {faceDetected ? "Face Tracking" : "No Face Detected"}
                </span>
              </div>

              <p>
                <strong>Mode:</strong> Auto AR Tracking
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
                disabled={
                  !cameraOn ||
                  savingPreview ||
                  loadingTracker ||
                  !trackingReady ||
                  !selectedRecordId
                }
              >
                {savingPreview
                  ? "Saving Snapshot..."
                  : "Capture & Save Snapshot"}
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
                    Start the camera to display the auto-fitted AR braces
                    filter.
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
                <canvas ref={overlayCanvasRef} className="ar-overlay-canvas" />
              )}

              {cameraOn && !faceDetected && (
                <div className="ar-tracking-warning">
                  Center your face and smile slightly
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden-canvas" />
          </div>

          {snapshotPreview && (
            <div className="ar-latest-snapshot-card">
              <div className="ar-latest-snapshot-header">
                <div>
                  <h3>Latest Captured Snapshot</h3>
                  <p>
                    This is the most recent frame captured during this session.
                  </p>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSnapshotPreview("")}
                  disabled={savingPreview}
                >
                  Dismiss Preview
                </button>
              </div>

              <img
                src={snapshotPreview}
                alt={`Latest ${getBraceStyleLabel()} AR braces snapshot`}
                className="ar-latest-snapshot-image"
              />
            </div>
          )}

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
                        <strong>Braces Style:</strong>{" "}
                        {getBraceStyleLabelFromValue(preview.brace_style)}
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