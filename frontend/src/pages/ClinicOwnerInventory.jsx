import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import "../styles/dashboard.css";

const EMPTY_ITEM_FORM = {
  sku: "",
  item_name: "",
  category: "Dental Materials",
  unit: "piece",
  quantity_on_hand: "0",
  reorder_level: "0",
  unit_cost: "0",
  supplier_name: "",
  storage_location: "",
  expiration_date: "",
  notes: "",
  status: "Active",
};

const EMPTY_MOVEMENT_FORM = {
  movement_type: "Stock In",
  quantity: "",
  reason: "",
  reference_number: "",
};

const DEFAULT_CATEGORIES = [
  "Dental Materials",
  "Disposable Supplies",
  "Medicines",
  "Instruments",
  "PPE",
  "Cleaning Supplies",
  "Office Supplies",
  "Other",
];

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });

const formatDate = (value) => {
  if (!value) return "N/A";

  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-PH",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  );
};

const formatDateTime = (value) => {
  if (!value) return "N/A";

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
};

const ClinicOwnerInventory = () => {
  const [locations, setLocations] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [clinic, setClinic] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [summary, setSummary] = useState({
    total_items: 0,
    in_stock_items: 0,
    low_stock_items: 0,
    out_of_stock_items: 0,
    expiring_soon_items: 0,
    estimated_stock_value: 0,
  });

  const [filters, setFilters] = useState({
    search: "",
    category: "All",
    stock_status: "All",
    record_status: "Active",
  });

  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT_FORM);
  const [editingItem, setEditingItem] = useState(null);
  const [movementItem, setMovementItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [movements, setMovements] = useState([]);

  const [showItemModal, setShowItemModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedLocation = useMemo(
    () =>
      locations.find(
        (location) => Number(location.clinic_id) === Number(selectedClinicId),
      ) || null,
    [locations, selectedClinicId],
  );

  const loadLocations = useCallback(async () => {
    try {
      setLoadingLocations(true);
      setError("");

      const response = await API.get("/api/clinics/owner/locations");
      const ownedLocations =
        response.data.locations ||
        response.data.clinics ||
        response.data.clinic_locations ||
        [];

      setLocations(ownedLocations);

      if (ownedLocations.length > 0) {
        setSelectedClinicId((current) => {
          const stillExists = ownedLocations.some(
            (location) => Number(location.clinic_id) === Number(current),
          );

          return stillExists ? current : String(ownedLocations[0].clinic_id);
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load owned clinic locations.",
      );
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    if (!selectedClinicId) {
      setItems([]);
      return;
    }

    try {
      setLoadingItems(true);
      setError("");

      const params = {
        clinic_id: selectedClinicId,
        search: filters.search,
        category: filters.category,
        stock_status: filters.stock_status,
        record_status: filters.record_status,
      };

      const [itemsResponse, summaryResponse] = await Promise.all([
        API.get("/api/inventory", { params }),
        API.get("/api/inventory/summary", {
          params: { clinic_id: selectedClinicId },
        }),
      ]);

      setClinic(itemsResponse.data.clinic || selectedLocation);
      setItems(itemsResponse.data.items || []);
      setCategories(itemsResponse.data.categories || DEFAULT_CATEGORIES);
      setSummary(
        summaryResponse.data.summary || {
          total_items: 0,
          in_stock_items: 0,
          low_stock_items: 0,
          out_of_stock_items: 0,
          expiring_soon_items: 0,
          estimated_stock_value: 0,
        },
      );
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load inventory.");
    } finally {
      setLoadingItems(false);
    }
  }, [selectedClinicId, selectedLocation, filters]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInventory();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  const resetNotices = () => {
    setMessage("");
    setError("");
  };

  const openAddModal = () => {
    resetNotices();
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setShowItemModal(true);
  };

  const openEditModal = (item) => {
    resetNotices();
    setEditingItem(item);
    setItemForm({
      sku: item.sku || "",
      item_name: item.item_name || "",
      category: item.category || "Dental Materials",
      unit: item.unit || "piece",
      quantity_on_hand: String(item.quantity_on_hand ?? 0),
      reorder_level: String(item.reorder_level ?? 0),
      unit_cost: String(item.unit_cost ?? 0),
      supplier_name: item.supplier_name || "",
      storage_location: item.storage_location || "",
      expiration_date: item.expiration_date
        ? String(item.expiration_date).slice(0, 10)
        : "",
      notes: item.notes || "",
      status: item.status || "Active",
    });
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    if (saving) return;
    setShowItemModal(false);
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
  };

  const openMovementModal = (item, movementType = "Stock In") => {
    resetNotices();
    setMovementItem(item);
    setMovementForm({
      ...EMPTY_MOVEMENT_FORM,
      movement_type: movementType,
    });
    setShowMovementModal(true);
  };

  const closeMovementModal = () => {
    if (saving) return;
    setShowMovementModal(false);
    setMovementItem(null);
    setMovementForm(EMPTY_MOVEMENT_FORM);
  };

  const openHistoryModal = async (item) => {
    resetNotices();
    setHistoryItem(item);
    setMovements([]);
    setShowHistoryModal(true);

    try {
      setLoadingHistory(true);
      const response = await API.get(
        `/api/inventory/${item.inventory_item_id}/movements`,
      );
      setMovements(response.data.movements || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load inventory movement history.",
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryItem(null);
    setMovements([]);
  };

  const handleItemSubmit = async (event) => {
    event.preventDefault();

    if (!selectedClinicId) {
      setError("Select a clinic location first.");
      return;
    }

    try {
      setSaving(true);
      resetNotices();

      const payload = {
        clinic_id: Number(selectedClinicId),
        ...itemForm,
        quantity_on_hand: Number(itemForm.quantity_on_hand || 0),
        reorder_level: Number(itemForm.reorder_level || 0),
        unit_cost: Number(itemForm.unit_cost || 0),
      };

      const response = editingItem
        ? await API.put(
            `/api/inventory/${editingItem.inventory_item_id}`,
            payload,
          )
        : await API.post("/api/inventory", payload);

      setMessage(
        response.data.message ||
          (editingItem
            ? "Inventory item updated successfully."
            : "Inventory item added successfully."),
      );
      closeItemModal();
      await loadInventory();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to save the inventory item.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMovementSubmit = async (event) => {
    event.preventDefault();

    if (!movementItem) {
      setError("Select an inventory item first.");
      return;
    }

    try {
      setSaving(true);
      resetNotices();

      const response = await API.post(
        `/api/inventory/${movementItem.inventory_item_id}/movements`,
        {
          ...movementForm,
          quantity: Number(movementForm.quantity || 0),
        },
      );

      setMessage(
        response.data.message ||
          "Inventory stock movement recorded successfully.",
      );
      closeMovementModal();
      await loadInventory();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to record the inventory movement.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (item) => {
    const nextStatus = item.status === "Active" ? "Archived" : "Active";
    const confirmed = window.confirm(
      `${nextStatus === "Archived" ? "Archive" : "Restore"} ${item.item_name}?`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      resetNotices();

      const response = await API.put(
        `/api/inventory/${item.inventory_item_id}`,
        {
          ...item,
          expiration_date: item.expiration_date
            ? String(item.expiration_date).slice(0, 10)
            : "",
          status: nextStatus,
        },
      );

      setMessage(response.data.message || "Inventory item updated.");
      await loadInventory();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to update the inventory item status.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!clinic && !selectedLocation) {
      setError("Select a clinic location before printing.");
      return;
    }

    const reportClinic = clinic || selectedLocation;
    const generatedAt = new Date().toLocaleString("en-PH");

    const escapeHtml = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const inventoryRows = items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.sku || "—")}</td>
            <td>
              <strong>${escapeHtml(item.item_name)}</strong>
              <div class="muted">${escapeHtml(item.unit)}</div>
            </td>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(formatNumber(item.quantity_on_hand))} ${escapeHtml(
              item.unit,
            )}</td>
            <td>${escapeHtml(formatNumber(item.reorder_level))} ${escapeHtml(
              item.unit,
            )}</td>
            <td>${escapeHtml(formatCurrency(item.unit_cost))}</td>
            <td>
              ${escapeHtml(formatDate(item.expiration_date))}
              ${
                item.expiration_status &&
                item.expiration_status !== "No Expiration"
                  ? `<div class="muted">${escapeHtml(
                      item.expiration_status,
                    )}</div>`
                  : ""
              }
            </td>
            <td>
              ${escapeHtml(item.supplier_name || "No supplier")}
              <div class="muted">${escapeHtml(
                item.storage_location || "No storage location",
              )}</div>
            </td>
            <td>
              ${escapeHtml(item.stock_status)}
              ${
                item.status === "Archived"
                  ? '<div class="muted">Archived</div>'
                  : ""
              }
            </td>
          </tr>
        `,
      )
      .join("");

    const reportHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Clinic Inventory Report</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 24px;
              color: #111827;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
            }

            .report-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 24px;
              margin-bottom: 18px;
              padding-bottom: 14px;
              border-bottom: 2px solid #111827;
            }

            .report-header h1 {
              margin: 0 0 6px;
              font-size: 24px;
            }

            .report-header p {
              margin: 3px 0;
              color: #374151;
              font-size: 12px;
            }

            .report-meta {
              min-width: 220px;
              text-align: right;
            }

            .summary-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 8px;
              margin-bottom: 18px;
            }

            .summary-card {
              min-height: 72px;
              padding: 10px;
              border: 1px solid #9ca3af;
            }

            .summary-card span {
              display: block;
              margin-bottom: 8px;
              color: #4b5563;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .summary-card strong {
              font-size: 15px;
            }

            .filter-note {
              margin: 0 0 10px;
              color: #4b5563;
              font-size: 10px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 9px;
            }

            th,
            td {
              padding: 6px;
              border: 1px solid #9ca3af;
              text-align: left;
              vertical-align: top;
              overflow-wrap: anywhere;
            }

            th {
              background: #f3f4f6;
              font-size: 8px;
              text-transform: uppercase;
            }

            .muted {
              margin-top: 3px;
              color: #4b5563;
              font-size: 8px;
            }

            .empty-state {
              padding: 28px;
              border: 1px solid #9ca3af;
              text-align: center;
            }

            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            @media print {
              body {
                padding: 0;
              }

              .summary-card,
              tr,
              td,
              th {
                break-inside: avoid;
              }
            }
          </style>
        </head>

        <body>
          <header class="report-header">
            <div>
              <h1>Clinic Inventory Report</h1>
              <p><strong>${escapeHtml(reportClinic.clinic_name || "")}</strong></p>
              <p>${escapeHtml(reportClinic.address || "")}</p>
              <p>${escapeHtml(reportClinic.contact_number || "")}</p>
            </div>

            <div class="report-meta">
              <p><strong>DentoGraph Inventory</strong></p>
              <p>Generated: ${escapeHtml(generatedAt)}</p>
              <p>Items shown: ${escapeHtml(items.length)}</p>
            </div>
          </header>

          <section class="summary-grid">
            <article class="summary-card">
              <span>Total Active Items</span>
              <strong>${escapeHtml(formatNumber(summary.total_items))}</strong>
            </article>
            <article class="summary-card">
              <span>In Stock</span>
              <strong>${escapeHtml(formatNumber(summary.in_stock_items))}</strong>
            </article>
            <article class="summary-card">
              <span>Low Stock</span>
              <strong>${escapeHtml(formatNumber(summary.low_stock_items))}</strong>
            </article>
            <article class="summary-card">
              <span>Out of Stock</span>
              <strong>${escapeHtml(
                formatNumber(summary.out_of_stock_items),
              )}</strong>
            </article>
            <article class="summary-card">
              <span>Expiring in 30 Days</span>
              <strong>${escapeHtml(
                formatNumber(summary.expiring_soon_items),
              )}</strong>
            </article>
            <article class="summary-card">
              <span>Estimated Stock Value</span>
              <strong>${escapeHtml(
                formatCurrency(summary.estimated_stock_value),
              )}</strong>
            </article>
          </section>

          <p class="filter-note">
            Printed filters:
            Search: ${escapeHtml(filters.search || "None")} ·
            Category: ${escapeHtml(filters.category)} ·
            Stock status: ${escapeHtml(filters.stock_status)} ·
            Record status: ${escapeHtml(filters.record_status)}
          </p>

          ${
            items.length === 0
              ? '<div class="empty-state">No inventory items match the selected filters.</div>'
              : `
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Reorder Level</th>
                      <th>Unit Cost</th>
                      <th>Expiration</th>
                      <th>Supplier / Storage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>${inventoryRows}</tbody>
                </table>
              `
          }
        </body>
      </html>
    `;

    const existingFrame = document.getElementById(
      "dentograph-inventory-print-frame",
    );

    if (existingFrame) {
      existingFrame.remove();
    }

    const printFrame = document.createElement("iframe");
    printFrame.id = "dentograph-inventory-print-frame";
    printFrame.title = "Clinic Inventory Print Report";
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.visibility = "hidden";

    document.body.appendChild(printFrame);

    const frameDocument =
      printFrame.contentDocument || printFrame.contentWindow?.document;

    if (!frameDocument || !printFrame.contentWindow) {
      printFrame.remove();
      setError("Unable to prepare the inventory report for printing.");
      return;
    }

    frameDocument.open();
    frameDocument.write(reportHtml);
    frameDocument.close();

    const printReport = () => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (printError) {
        setError("Unable to open the browser print dialog.");
      } finally {
        window.setTimeout(() => {
          printFrame.remove();
        }, 1000);
      }
    };

    if (frameDocument.readyState === "complete") {
      window.setTimeout(printReport, 150);
    } else {
      printFrame.onload = () => {
        window.setTimeout(printReport, 150);
      };
    }
  };

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card clinic-owner-inventory-page">
        <div className="appointments-header inventory-page-header">
          <div>
            <h1>Clinic Inventory</h1>
            <p>
              Manage location-specific dental supplies, stock movements, reorder
              levels, expiration dates, and printable inventory reports.
            </p>
          </div>

          <div className="inventory-header-actions no-print">
            <button
              type="button"
              className="secondary-button"
              onClick={handlePrint}
              disabled={!selectedClinicId || loadingItems}
            >
              Print Inventory
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={openAddModal}
              disabled={!selectedClinicId}
            >
              Add Inventory Item
            </button>
          </div>
        </div>

        <div className="inventory-print-header print-only">
          <h1>Clinic Inventory Report</h1>
          <p>{clinic?.clinic_name || selectedLocation?.clinic_name || ""}</p>
          <p>{clinic?.address || selectedLocation?.address || ""}</p>
          <p>Generated: {new Date().toLocaleString("en-PH")}</p>
        </div>

        {message && <div className="success-message no-print">{message}</div>}
        {error && <div className="error-message no-print">{error}</div>}

        <section className="inventory-location-section no-print">
          <div className="form-group">
            <label htmlFor="inventory-clinic-location">Clinic Location</label>
            <select
              id="inventory-clinic-location"
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
              disabled={loadingLocations || locations.length === 0}
            >
              {locations.length === 0 && (
                <option value="">No owned clinic locations</option>
              )}
              {locations.map((location) => (
                <option key={location.clinic_id} value={location.clinic_id}>
                  {location.clinic_name}
                </option>
              ))}
            </select>
          </div>

          {selectedLocation && (
            <div className="inventory-location-summary">
              <strong>{selectedLocation.clinic_name}</strong>
              <span>{selectedLocation.address || "No address provided"}</span>
            </div>
          )}
        </section>

        <section className="inventory-summary-grid">
          <article className="inventory-summary-card">
            <span>Total Active Items</span>
            <strong>{formatNumber(summary.total_items)}</strong>
          </article>

          <article className="inventory-summary-card">
            <span>In Stock</span>
            <strong>{formatNumber(summary.in_stock_items)}</strong>
          </article>

          <article className="inventory-summary-card inventory-summary-warning">
            <span>Low Stock</span>
            <strong>{formatNumber(summary.low_stock_items)}</strong>
          </article>

          <article className="inventory-summary-card inventory-summary-danger">
            <span>Out of Stock</span>
            <strong>{formatNumber(summary.out_of_stock_items)}</strong>
          </article>

          <article className="inventory-summary-card inventory-summary-warning">
            <span>Expiring in 30 Days</span>
            <strong>{formatNumber(summary.expiring_soon_items)}</strong>
          </article>

          <article className="inventory-summary-card">
            <span>Estimated Stock Value</span>
            <strong>{formatCurrency(summary.estimated_stock_value)}</strong>
          </article>
        </section>

        <section className="inventory-filter-card no-print">
          <div className="form-group inventory-search-field">
            <label htmlFor="inventory-search">Search</label>
            <input
              id="inventory-search"
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Item name, SKU, supplier, or storage location"
            />
          </div>

          <div className="form-group">
            <label htmlFor="inventory-category-filter">Category</label>
            <select
              id="inventory-category-filter"
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            >
              <option value="All">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="inventory-stock-filter">Stock Status</label>
            <select
              id="inventory-stock-filter"
              value={filters.stock_status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  stock_status: event.target.value,
                }))
              }
            >
              <option value="All">All Stock Statuses</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="inventory-record-filter">Record Status</label>
            <select
              id="inventory-record-filter"
              value={filters.record_status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  record_status: event.target.value,
                }))
              }
            >
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
              <option value="All">All</option>
            </select>
          </div>
        </section>

        <section className="inventory-table-section">
          {loadingItems ? (
            <div className="loading-message">Loading inventory...</div>
          ) : !selectedClinicId ? (
            <div className="empty-state">
              Select an owned clinic location to manage its inventory.
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <h3>No inventory items found</h3>
              <p>
                Add the clinic's first supply item or change the current
                filters.
              </p>
            </div>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Reorder Level</th>
                    <th>Unit Cost</th>
                    <th>Expiration</th>
                    <th>Supplier / Storage</th>
                    <th>Status</th>
                    <th className="no-print">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.inventory_item_id}>
                      <td>{item.sku || "—"}</td>

                      <td>
                        <strong>{item.item_name}</strong>
                        <span>{item.unit}</span>
                      </td>

                      <td>{item.category}</td>

                      <td>
                        <strong>
                          {formatNumber(item.quantity_on_hand)} {item.unit}
                        </strong>
                      </td>

                      <td>
                        {formatNumber(item.reorder_level)} {item.unit}
                      </td>

                      <td>{formatCurrency(item.unit_cost)}</td>

                      <td>
                        <span>{formatDate(item.expiration_date)}</span>
                        {item.expiration_status !== "No Expiration" && (
                          <small
                            className={`inventory-expiration inventory-expiration-${String(
                              item.expiration_status,
                            )
                              .toLowerCase()
                              .replaceAll(" ", "-")}`}
                          >
                            {item.expiration_status}
                          </small>
                        )}
                      </td>

                      <td>
                        <span>{item.supplier_name || "No supplier"}</span>
                        <small>
                          {item.storage_location || "No storage location"}
                        </small>
                      </td>

                      <td>
                        <span
                          className={`inventory-stock-status inventory-stock-status-${String(
                            item.stock_status,
                          )
                            .toLowerCase()
                            .replaceAll(" ", "-")}`}
                        >
                          {item.stock_status}
                        </span>
                        {item.status === "Archived" && (
                          <small className="inventory-archived-label">
                            Archived
                          </small>
                        )}
                      </td>

                      <td className="no-print">
                        <div className="inventory-row-actions">
                          {item.status === "Active" && (
                            <>
                              <button
                                type="button"
                                className="primary-button"
                                onClick={() =>
                                  openMovementModal(item, "Stock In")
                                }
                              >
                                Stock In
                              </button>

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  openMovementModal(item, "Stock Out")
                                }
                              >
                                Stock Out
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openEditModal(item)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openHistoryModal(item)}
                          >
                            History
                          </button>

                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => handleArchiveToggle(item)}
                            disabled={saving}
                          >
                            {item.status === "Active" ? "Archive" : "Restore"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showItemModal && (
        <div className="modal-overlay no-print">
          <div className="modal-content inventory-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
                </h2>
                <p>
                  {editingItem
                    ? "Update item details without changing stock movement history."
                    : `Add an item to ${
                        selectedLocation?.clinic_name || "this clinic"
                      }.`}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeItemModal}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              className="appointment-form inventory-item-form"
              onSubmit={handleItemSubmit}
            >
              <div className="form-group">
                <label htmlFor="inventory-item-name">Item Name *</label>
                <input
                  id="inventory-item-name"
                  value={itemForm.item_name}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      item_name: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-sku">SKU</label>
                <input
                  id="inventory-sku"
                  value={itemForm.sku}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                  placeholder="Optional clinic-specific code"
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-category">Category *</label>
                <select
                  id="inventory-category"
                  value={itemForm.category}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  required
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="inventory-unit">Unit *</label>
                <input
                  id="inventory-unit"
                  value={itemForm.unit}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                  placeholder="piece, box, bottle, pack"
                  required
                />
              </div>

              {!editingItem && (
                <div className="form-group">
                  <label htmlFor="inventory-opening-quantity">
                    Opening Quantity *
                  </label>
                  <input
                    id="inventory-opening-quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.quantity_on_hand}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        quantity_on_hand: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="inventory-reorder-level">Reorder Level *</label>
                <input
                  id="inventory-reorder-level"
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.reorder_level}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      reorder_level: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-unit-cost">Unit Cost (PHP) *</label>
                <input
                  id="inventory-unit-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.unit_cost}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      unit_cost: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-expiration-date">
                  Expiration Date
                </label>
                <input
                  id="inventory-expiration-date"
                  type="date"
                  value={itemForm.expiration_date}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      expiration_date: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-supplier">Supplier</label>
                <input
                  id="inventory-supplier"
                  value={itemForm.supplier_name}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      supplier_name: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-storage-location">
                  Storage Location
                </label>
                <input
                  id="inventory-storage-location"
                  value={itemForm.storage_location}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      storage_location: event.target.value,
                    }))
                  }
                  placeholder="Cabinet, room, shelf"
                />
              </div>

              {editingItem && (
                <div className="form-group">
                  <label htmlFor="inventory-item-status">Record Status</label>
                  <select
                    id="inventory-item-status"
                    value={itemForm.status}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              )}

              <div className="form-group inventory-form-full">
                <label htmlFor="inventory-notes">Notes</label>
                <textarea
                  id="inventory-notes"
                  rows="3"
                  value={itemForm.notes}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="modal-actions inventory-form-full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeItemModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingItem
                      ? "Save Changes"
                      : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMovementModal && movementItem && (
        <div className="modal-overlay no-print">
          <div className="modal-content inventory-movement-modal">
            <div className="modal-header">
              <div>
                <h2>Record Stock Movement</h2>
                <p>
                  {movementItem.item_name} · Current stock:{" "}
                  {formatNumber(movementItem.quantity_on_hand)}{" "}
                  {movementItem.unit}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeMovementModal}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              className="appointment-form inventory-movement-form"
              onSubmit={handleMovementSubmit}
            >
              <div className="form-group">
                <label htmlFor="inventory-movement-type">Movement Type</label>
                <select
                  id="inventory-movement-type"
                  value={movementForm.movement_type}
                  onChange={(event) =>
                    setMovementForm((current) => ({
                      ...current,
                      movement_type: event.target.value,
                    }))
                  }
                >
                  <option value="Stock In">Stock In</option>
                  <option value="Stock Out">Stock Out</option>
                  <option value="Adjustment">Set Exact Quantity</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="inventory-movement-quantity">
                  {movementForm.movement_type === "Adjustment"
                    ? "New Exact Quantity"
                    : "Quantity"}
                </label>
                <input
                  id="inventory-movement-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={movementForm.quantity}
                  onChange={(event) =>
                    setMovementForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-reference-number">
                  Reference Number
                </label>
                <input
                  id="inventory-reference-number"
                  value={movementForm.reference_number}
                  onChange={(event) =>
                    setMovementForm((current) => ({
                      ...current,
                      reference_number: event.target.value,
                    }))
                  }
                  placeholder="Delivery receipt or internal reference"
                />
              </div>

              <div className="form-group">
                <label htmlFor="inventory-movement-reason">Reason *</label>
                <textarea
                  id="inventory-movement-reason"
                  rows="3"
                  value={movementForm.reason}
                  onChange={(event) =>
                    setMovementForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Purchase delivery, clinical use, damaged item, stock count correction"
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeMovementModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Record Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && historyItem && (
        <div className="modal-overlay no-print">
          <div className="modal-content inventory-history-modal">
            <div className="modal-header">
              <div>
                <h2>Stock Movement History</h2>
                <p>
                  {historyItem.item_name} · Current stock:{" "}
                  {formatNumber(historyItem.quantity_on_hand)}{" "}
                  {historyItem.unit}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeHistoryModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {loadingHistory ? (
              <div className="loading-message">Loading movement history...</div>
            ) : movements.length === 0 ? (
              <div className="empty-state">
                No stock movements have been recorded.
              </div>
            ) : (
              <div className="inventory-history-table-wrap">
                <table className="inventory-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Change</th>
                      <th>Before</th>
                      <th>After</th>
                      <th>Reason</th>
                      <th>Reference</th>
                      <th>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.inventory_movement_id}>
                        <td>{formatDateTime(movement.created_at)}</td>
                        <td>{movement.movement_type}</td>
                        <td>
                          {Number(movement.quantity_change) > 0 ? "+" : ""}
                          {formatNumber(movement.quantity_change)}
                        </td>
                        <td>{formatNumber(movement.quantity_before)}</td>
                        <td>{formatNumber(movement.quantity_after)}</td>
                        <td>{movement.reason}</td>
                        <td>{movement.reference_number || "—"}</td>
                        <td>{movement.created_by_name || "System"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      )}
    </DashboardLayout>
  );
};

export default ClinicOwnerInventory;
