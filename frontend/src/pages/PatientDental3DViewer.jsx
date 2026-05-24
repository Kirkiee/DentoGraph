import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";

function ToothModel({
  tooth,
  position,
  rotation,
  isUpper,
  selectedTooth,
  onSelect,
}) {
  const isSelected = selectedTooth?.tooth_number === tooth.tooth_number;
  const toothNumber = Number(tooth.tooth_number);

  const getToothType = () => {
    const lastDigit = toothNumber % 10;

    if (lastDigit === 1 || lastDigit === 2) return "incisor";
    if (lastDigit === 3) return "canine";
    if (lastDigit === 4 || lastDigit === 5) return "premolar";

    return "molar";
  };

  const getToothColor = () => {
    if (isSelected) return "#14b8a6";

    switch (tooth.tooth_status) {
      case "Decayed":
        return "#ef4444";
      case "Filled":
        return "#f59e0b";
      case "Missing":
        return "#64748b";
      case "Crowned":
        return "#a855f7";
      case "Impacted":
        return "#0ea5e9";
      case "Normal":
      default:
        return "#fefce8";
    }
  };

  const toothType = getToothType();
  const toothColor = getToothColor();

  const getCrownScale = () => {
    switch (toothType) {
      case "incisor":
        return [0.32, 0.55, 0.22];
      case "canine":
        return [0.35, 0.65, 0.28];
      case "premolar":
        return [0.43, 0.5, 0.38];
      case "molar":
      default:
        return [0.58, 0.48, 0.5];
    }
  };

  const getRootScale = () => {
    switch (toothType) {
      case "incisor":
        return [0.18, 0.45, 0.14];
      case "canine":
        return [0.2, 0.55, 0.16];
      case "premolar":
        return [0.24, 0.42, 0.2];
      case "molar":
      default:
        return [0.32, 0.38, 0.26];
    }
  };

  const crownScale = getCrownScale();
  const rootScale = getRootScale();

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(tooth);
      }}
    >
      <group rotation={isUpper ? [0, 0, Math.PI] : [0, 0, 0]}>
        <mesh
          position={[0, -0.23, 0]}
          scale={rootScale}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[1, 1.1, 24]} />
          <meshStandardMaterial color="#f5e6c8" roughness={0.55} />
        </mesh>

        <mesh
          position={[0, 0.15, 0]}
          scale={crownScale}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color={toothColor} roughness={0.32} />
        </mesh>

        {(toothType === "molar" || toothType === "premolar") && (
          <>
            <mesh position={[-0.14, 0.5, 0.1]} scale={[0.16, 0.1, 0.16]}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial color={toothColor} roughness={0.35} />
            </mesh>

            <mesh position={[0.14, 0.5, 0.1]} scale={[0.16, 0.1, 0.16]}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial color={toothColor} roughness={0.35} />
            </mesh>

            <mesh position={[-0.14, 0.5, -0.1]} scale={[0.16, 0.1, 0.16]}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial color={toothColor} roughness={0.35} />
            </mesh>

            <mesh position={[0.14, 0.5, -0.1]} scale={[0.16, 0.1, 0.16]}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial color={toothColor} roughness={0.35} />
            </mesh>
          </>
        )}

        {toothType === "canine" && (
          <mesh position={[0, 0.56, 0]} scale={[0.2, 0.22, 0.2]}>
            <coneGeometry args={[1, 1, 24]} />
            <meshStandardMaterial color={toothColor} roughness={0.35} />
          </mesh>
        )}

        {toothType === "incisor" && (
          <mesh position={[0, 0.52, 0]} scale={[0.28, 0.06, 0.2]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={toothColor} roughness={0.35} />
          </mesh>
        )}

        {isSelected && (
          <mesh
            position={[0, 0.15, 0]}
            scale={[
              crownScale[0] * 1.12,
              crownScale[1] * 1.12,
              crownScale[2] * 1.12,
            ]}
          >
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color="#14b8a6" wireframe />
          </mesh>
        )}
      </group>

      <Text
        position={[0, isUpper ? 0.95 : -0.95, 0]}
        fontSize={0.18}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
      >
        {tooth.tooth_number}
      </Text>
    </group>
  );
}

function DentalArch({ teeth, selectedTooth, onSelect }) {
  const positionedTeeth = useMemo(() => {
    const upperNumbers = [
      18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
    ];

    const lowerNumbers = [
      48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
    ];

    const getSpacing = (number) => {
      const lastDigit = Number(number) % 10;

      if (lastDigit === 1 || lastDigit === 2) return 0.46;
      if (lastDigit === 3) return 0.52;
      if (lastDigit === 4 || lastDigit === 5) return 0.58;

      return 0.68;
    };

    const makeArch = (numbers, yOffset, curveDirection, isUpper) => {
      let currentX = -4.4;

      return numbers.map((number, index) => {
        const tooth = teeth.find(
          (item) => Number(item.tooth_number) === Number(number),
        ) || {
          tooth_id: null,
          tooth_number: number,
          tooth_status: "Normal",
        };

        const spacing = getSpacing(number);
        currentX += spacing;

        const center = (numbers.length - 1) / 2;
        const distanceFromCenter = index - center;

        const x = currentX;
        const z = curveDirection * Math.pow(distanceFromCenter, 2) * 0.035;
        const rotationZ = distanceFromCenter * 0.035;

        return {
          tooth,
          position: [x, yOffset, z],
          rotation: [0, 0, rotationZ],
          isUpper,
        };
      });
    };

    return [
      ...makeArch(upperNumbers, 1.15, -1, true),
      ...makeArch(lowerNumbers, -1.15, 1, false),
    ];
  }, [teeth]);

  return (
    <>
      {positionedTeeth.map((item) => (
        <ToothModel
          key={item.tooth.tooth_number}
          tooth={item.tooth}
          position={item.position}
          rotation={item.rotation}
          isUpper={item.isUpper}
          selectedTooth={selectedTooth}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function PatientDental3DViewer() {
  const { record_id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [teeth, setTeeth] = useState([]);
  const [selectedTooth, setSelectedTooth] = useState(null);

  const [loading, setLoading] = useState(true);
  const [message] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchRecordDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record_id]);

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
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load 3D dental record data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTooth = (tooth) => {
    setSelectedTooth(tooth);
    setError("");
  };

  const getStatusDescription = (status) => {
    switch (status) {
      case "Decayed":
        return "Tooth has decay or cavity concerns.";
      case "Filled":
        return "Tooth has an existing dental filling.";
      case "Missing":
        return "Tooth is marked as missing.";
      case "Crowned":
        return "Tooth has a crown restoration.";
      case "Impacted":
        return "Tooth may be impacted or not fully erupted.";
      case "Normal":
      default:
        return "Tooth is marked as normal.";
    }
  };

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My 3D Dental Visualization</h2>
            <p>
              View your dental chart in 3D. This page is read-only and reflects
              the latest tooth status recorded by your dentist.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate(`/patient/records/${record_id}`)}
            >
              Back to Record
            </button>

            <button
              className="secondary-button"
              onClick={fetchRecordDetails}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading 3D dental viewer...</p>
        ) : !record ? (
          <div className="empty-state">
            <h3>Record not found</h3>
            <p>The selected dental record could not be loaded.</p>
          </div>
        ) : (
          <div className="dental-3d-layout">
            <div className="dental-3d-viewer">
              <Canvas camera={{ position: [0, 0, 7], fov: 55 }} shadows>
                <ambientLight intensity={0.85} />
                <directionalLight
                  position={[5, 5, 5]}
                  intensity={1.2}
                  castShadow
                />
                <pointLight position={[-5, -5, 5]} intensity={0.6} />

                <DentalArch
                  teeth={teeth}
                  selectedTooth={selectedTooth}
                  onSelect={handleSelectTooth}
                />

                <OrbitControls enablePan enableZoom enableRotate />
              </Canvas>
            </div>

            <div className="dental-3d-panel">
              <h3>Record #{record.record_id}</h3>

              <p>
                <strong>Patient:</strong>{" "}
                {record.patient_name || `Patient ID ${record.patient_id}`}
              </p>

              <p>
                <strong>Dentist:</strong>{" "}
                {record.dentist_name || `Dentist ID ${record.dentist_id}`}
              </p>

              <p>
                <strong>Clinic:</strong>{" "}
                {record.clinic_name || "No assigned clinic"}
              </p>

              <p>
                <strong>Selected Tooth:</strong>{" "}
                {selectedTooth
                  ? `Tooth #${selectedTooth.tooth_number}`
                  : "None selected"}
              </p>

              {selectedTooth ? (
                <>
                  <p>
                    <strong>Current Status:</strong>{" "}
                    {selectedTooth.tooth_status || "Normal"}
                  </p>

                  <p>{getStatusDescription(selectedTooth.tooth_status)}</p>
                </>
              ) : (
                <div className="empty-state">
                  <h3>No tooth selected</h3>
                  <p>Click a tooth in the 3D chart to view its status.</p>
                </div>
              )}

              <div className="dental-legend">
                <h3>Legend</h3>

                <p>
                  <span className="legend-dot normal"></span> Normal
                </p>
                <p>
                  <span className="legend-dot decayed"></span> Decayed
                </p>
                <p>
                  <span className="legend-dot filled"></span> Filled
                </p>
                <p>
                  <span className="legend-dot missing"></span> Missing
                </p>
                <p>
                  <span className="legend-dot crowned"></span> Crowned
                </p>
                <p>
                  <span className="legend-dot impacted"></span> Impacted
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientDental3DViewer;
