const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const createAuditLog = require("../utils/auditLogger");

const INVENTORY_CATEGORIES = [
  "Dental Materials",
  "Disposable Supplies",
  "Medicines",
  "Instruments",
  "PPE",
  "Cleaning Supplies",
  "Office Supplies",
  "Other",
];

const MOVEMENT_TYPES = ["Stock In", "Stock Out", "Adjustment"];

const cleanText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeNullable = (value) => {
  const cleaned = cleanText(value);
  return cleaned || null;
};

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseNonNegativeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const getOwnedClinic = async (userId, clinicId, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
       c.clinic_id,
       c.clinic_name,
       c.address,
       c.contact_number,
       c.status
     FROM public.clinics c
     WHERE c.clinic_id = $1
       AND c.owner_user_id = $2
     LIMIT 1`,
    [clinicId, userId],
  );

  return result.rows[0] || null;
};

const getOwnedInventoryItem = async (
  userId,
  itemId,
  queryClient = pool,
  { lock = false } = {},
) => {
  const result = await queryClient.query(
    `SELECT
       i.*,
       c.clinic_name
     FROM public.inventory_items i
     JOIN public.clinics c ON c.clinic_id = i.clinic_id
     WHERE i.inventory_item_id = $1
       AND c.owner_user_id = $2
     ${lock ? "FOR UPDATE OF i" : ""}
     LIMIT 1`,
    [itemId, userId],
  );

  return result.rows[0] || null;
};

const getStockStatusSql = () => `
  CASE
    WHEN i.quantity_on_hand <= 0 THEN 'Out of Stock'
    WHEN i.quantity_on_hand <= i.reorder_level THEN 'Low Stock'
    ELSE 'In Stock'
  END
`;

router.use(authenticateToken, authorizeRoles("Clinic Owner"));

// GET INVENTORY SUMMARY
router.get("/summary", async (req, res) => {
  const clinicId = parsePositiveInteger(req.query.clinic_id);

  if (!clinicId) {
    return res.status(400).json({
      error: "A valid clinic location is required.",
    });
  }

  try {
    const clinic = await getOwnedClinic(req.user.user_id, clinicId);

    if (!clinic) {
      return res.status(403).json({
        error: "Clinic location not found or not owned by this account.",
      });
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Active')::int AS total_items,
         COUNT(*) FILTER (
           WHERE status = 'Active'
             AND quantity_on_hand > reorder_level
         )::int AS in_stock_items,
         COUNT(*) FILTER (
           WHERE status = 'Active'
             AND quantity_on_hand > 0
             AND quantity_on_hand <= reorder_level
         )::int AS low_stock_items,
         COUNT(*) FILTER (
           WHERE status = 'Active'
             AND quantity_on_hand <= 0
         )::int AS out_of_stock_items,
         COUNT(*) FILTER (
           WHERE status = 'Active'
             AND expiration_date IS NOT NULL
             AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
             AND expiration_date >= CURRENT_DATE
         )::int AS expiring_soon_items,
         COALESCE(
           SUM(quantity_on_hand * unit_cost)
             FILTER (WHERE status = 'Active'),
           0
         )::numeric(14,2) AS estimated_stock_value
       FROM public.inventory_items
       WHERE clinic_id = $1`,
      [clinicId],
    );

    return res.status(200).json({
      clinic,
      summary: result.rows[0],
    });
  } catch (err) {
    console.error("Get inventory summary error:", err.message);
    return res.status(500).json({
      error: "Unable to load the inventory summary.",
    });
  }
});

// GET INVENTORY ITEMS
router.get("/", async (req, res) => {
  const clinicId = parsePositiveInteger(req.query.clinic_id);
  const search = cleanText(req.query.search);
  const category = cleanText(req.query.category || "All");
  const stockStatus = cleanText(req.query.stock_status || "All");
  const recordStatus = cleanText(req.query.record_status || "Active");

  if (!clinicId) {
    return res.status(400).json({
      error: "A valid clinic location is required.",
    });
  }

  try {
    const clinic = await getOwnedClinic(req.user.user_id, clinicId);

    if (!clinic) {
      return res.status(403).json({
        error: "Clinic location not found or not owned by this account.",
      });
    }

    const values = [clinicId];
    const filters = ["i.clinic_id = $1"];

    if (recordStatus !== "All") {
      values.push(recordStatus);
      filters.push(`i.status = $${values.length}`);
    }

    if (category !== "All") {
      values.push(category);
      filters.push(`i.category = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      filters.push(
        `(i.item_name ILIKE $${values.length}
          OR COALESCE(i.sku, '') ILIKE $${values.length}
          OR COALESCE(i.supplier_name, '') ILIKE $${values.length}
          OR COALESCE(i.storage_location, '') ILIKE $${values.length})`,
      );
    }

    if (stockStatus !== "All") {
      values.push(stockStatus);
      filters.push(`${getStockStatusSql()} = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT
         i.*,
         ${getStockStatusSql()} AS stock_status,
         CASE
           WHEN i.expiration_date IS NULL THEN 'No Expiration'
           WHEN i.expiration_date < CURRENT_DATE THEN 'Expired'
           WHEN i.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
             THEN 'Expiring Soon'
           ELSE 'Valid'
         END AS expiration_status
       FROM public.inventory_items i
       WHERE ${filters.join(" AND ")}
       ORDER BY
         CASE
           WHEN i.quantity_on_hand <= 0 THEN 1
           WHEN i.quantity_on_hand <= i.reorder_level THEN 2
           ELSE 3
         END,
         i.item_name ASC`,
      values,
    );

    return res.status(200).json({
      clinic,
      categories: INVENTORY_CATEGORIES,
      items: result.rows,
    });
  } catch (err) {
    console.error("Get inventory items error:", err.message);

    if (err.code === "42P01") {
      return res.status(500).json({
        error:
          "Inventory tables are missing. Run the inventory migration first.",
      });
    }

    return res.status(500).json({
      error: "Unable to load inventory items.",
    });
  }
});

// GET ITEM MOVEMENT HISTORY
router.get("/:item_id/movements", async (req, res) => {
  const itemId = parsePositiveInteger(req.params.item_id);

  if (!itemId) {
    return res.status(400).json({
      error: "A valid inventory item is required.",
    });
  }

  try {
    const item = await getOwnedInventoryItem(req.user.user_id, itemId);

    if (!item) {
      return res.status(404).json({
        error: "Inventory item not found.",
      });
    }

    const result = await pool.query(
      `SELECT
         m.*,
         u.name AS created_by_name
       FROM public.inventory_movements m
       LEFT JOIN public.users u ON u.user_id = m.created_by
       WHERE m.inventory_item_id = $1
       ORDER BY m.created_at DESC, m.inventory_movement_id DESC`,
      [itemId],
    );

    return res.status(200).json({
      item,
      movements: result.rows,
    });
  } catch (err) {
    console.error("Get inventory movements error:", err.message);
    return res.status(500).json({
      error: "Unable to load inventory movement history.",
    });
  }
});

// CREATE INVENTORY ITEM
router.post("/", async (req, res) => {
  const clinicId = parsePositiveInteger(req.body.clinic_id);
  const itemName = cleanText(req.body.item_name);
  const sku = normalizeNullable(req.body.sku);
  const category = cleanText(req.body.category);
  const unit = cleanText(req.body.unit);
  const quantity = parseNonNegativeNumber(req.body.quantity_on_hand);
  const reorderLevel = parseNonNegativeNumber(req.body.reorder_level);
  const unitCost = parseNonNegativeNumber(req.body.unit_cost);
  const supplierName = normalizeNullable(req.body.supplier_name);
  const storageLocation = normalizeNullable(req.body.storage_location);
  const expirationDate = normalizeNullable(req.body.expiration_date);
  const notes = normalizeNullable(req.body.notes);

  if (!clinicId || !itemName || !category || !unit) {
    return res.status(400).json({
      error: "Clinic, item name, category, and unit are required.",
    });
  }

  if (!INVENTORY_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: "Invalid inventory category.",
    });
  }

  if (quantity === null || reorderLevel === null || unitCost === null) {
    return res.status(400).json({
      error: "Quantity, reorder level, and unit cost must be non-negative.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const clinic = await getOwnedClinic(req.user.user_id, clinicId, client);

    if (!clinic) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Clinic location not found or not owned by this account.",
      });
    }

    const result = await client.query(
      `INSERT INTO public.inventory_items
       (
         clinic_id,
         sku,
         item_name,
         category,
         unit,
         quantity_on_hand,
         reorder_level,
         unit_cost,
         supplier_name,
         storage_location,
         expiration_date,
         notes,
         status,
         created_by,
         updated_by
       )
       VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        'Active', $13, $13)
       RETURNING *`,
      [
        clinicId,
        sku,
        itemName,
        category,
        unit,
        quantity,
        reorderLevel,
        unitCost,
        supplierName,
        storageLocation,
        expirationDate,
        notes,
        req.user.user_id,
      ],
    );

    if (quantity > 0) {
      await client.query(
        `INSERT INTO public.inventory_movements
         (
           inventory_item_id,
           clinic_id,
           movement_type,
           quantity_change,
           quantity_before,
           quantity_after,
           reason,
           reference_number,
           created_by
         )
         VALUES ($1, $2, 'Stock In', $3, 0, $3,
                 'Opening inventory balance', NULL, $4)`,
        [
          result.rows[0].inventory_item_id,
          clinicId,
          quantity,
          req.user.user_id,
        ],
      );
    }

    await client.query("COMMIT");

    await createAuditLog({
      user_id: req.user.user_id,
      action: "CREATE_INVENTORY_ITEM",
      module: "Clinic Inventory",
      description: `Created inventory item ${itemName} for ${clinic.clinic_name}.`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Inventory item added successfully.",
      item: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Create inventory item error:", err.message);

    if (err.code === "23505") {
      return res.status(409).json({
        error: "The SKU is already used by another item in this clinic.",
      });
    }

    return res.status(500).json({
      error: "Unable to add the inventory item.",
    });
  } finally {
    client.release();
  }
});

// UPDATE INVENTORY ITEM DETAILS
router.put("/:item_id", async (req, res) => {
  const itemId = parsePositiveInteger(req.params.item_id);
  const itemName = cleanText(req.body.item_name);
  const sku = normalizeNullable(req.body.sku);
  const category = cleanText(req.body.category);
  const unit = cleanText(req.body.unit);
  const reorderLevel = parseNonNegativeNumber(req.body.reorder_level);
  const unitCost = parseNonNegativeNumber(req.body.unit_cost);
  const supplierName = normalizeNullable(req.body.supplier_name);
  const storageLocation = normalizeNullable(req.body.storage_location);
  const expirationDate = normalizeNullable(req.body.expiration_date);
  const notes = normalizeNullable(req.body.notes);
  const status = cleanText(req.body.status || "Active");

  if (!itemId || !itemName || !category || !unit) {
    return res.status(400).json({
      error: "Item name, category, and unit are required.",
    });
  }

  if (!INVENTORY_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: "Invalid inventory category.",
    });
  }

  if (reorderLevel === null || unitCost === null) {
    return res.status(400).json({
      error: "Reorder level and unit cost must be non-negative.",
    });
  }

  if (!["Active", "Archived"].includes(status)) {
    return res.status(400).json({
      error: "Invalid inventory record status.",
    });
  }

  try {
    const existing = await getOwnedInventoryItem(req.user.user_id, itemId);

    if (!existing) {
      return res.status(404).json({
        error: "Inventory item not found.",
      });
    }

    const result = await pool.query(
      `UPDATE public.inventory_items
       SET sku = $1,
           item_name = $2,
           category = $3,
           unit = $4,
           reorder_level = $5,
           unit_cost = $6,
           supplier_name = $7,
           storage_location = $8,
           expiration_date = $9,
           notes = $10,
           status = $11,
           updated_by = $12,
           updated_at = CURRENT_TIMESTAMP
       WHERE inventory_item_id = $13
       RETURNING *`,
      [
        sku,
        itemName,
        category,
        unit,
        reorderLevel,
        unitCost,
        supplierName,
        storageLocation,
        expirationDate,
        notes,
        status,
        req.user.user_id,
        itemId,
      ],
    );

    await createAuditLog({
      user_id: req.user.user_id,
      action: "UPDATE_INVENTORY_ITEM",
      module: "Clinic Inventory",
      description: `Updated inventory item ${itemName} for ${existing.clinic_name}.`,
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Inventory item updated successfully.",
      item: result.rows[0],
    });
  } catch (err) {
    console.error("Update inventory item error:", err.message);

    if (err.code === "23505") {
      return res.status(409).json({
        error: "The SKU is already used by another item in this clinic.",
      });
    }

    return res.status(500).json({
      error: "Unable to update the inventory item.",
    });
  }
});

// RECORD STOCK MOVEMENT
router.post("/:item_id/movements", async (req, res) => {
  const itemId = parsePositiveInteger(req.params.item_id);
  const movementType = cleanText(req.body.movement_type);
  const enteredQuantity = parseNonNegativeNumber(req.body.quantity);
  const reason = cleanText(req.body.reason);
  const referenceNumber = normalizeNullable(req.body.reference_number);

  if (!itemId || !MOVEMENT_TYPES.includes(movementType)) {
    return res.status(400).json({
      error: "A valid item and movement type are required.",
    });
  }

  if (enteredQuantity === null) {
    return res.status(400).json({
      error: "Enter a valid non-negative quantity.",
    });
  }

  if (!reason) {
    return res.status(400).json({
      error: "A movement reason is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const item = await getOwnedInventoryItem(req.user.user_id, itemId, client, {
      lock: true,
    });

    if (!item) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Inventory item not found.",
      });
    }

    if (item.status !== "Active") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Archived items cannot receive stock movements.",
      });
    }

    const quantityBefore = Number(item.quantity_on_hand);
    let quantityAfter;
    let quantityChange;

    if (movementType === "Stock In") {
      if (enteredQuantity <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Stock-in quantity must be greater than zero.",
        });
      }

      quantityChange = enteredQuantity;
      quantityAfter = quantityBefore + enteredQuantity;
    } else if (movementType === "Stock Out") {
      if (enteredQuantity <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Stock-out quantity must be greater than zero.",
        });
      }

      if (enteredQuantity > quantityBefore) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Stock-out quantity exceeds the available stock.",
        });
      }

      quantityChange = -enteredQuantity;
      quantityAfter = quantityBefore - enteredQuantity;
    } else {
      quantityAfter = enteredQuantity;
      quantityChange = quantityAfter - quantityBefore;
    }

    const updated = await client.query(
      `UPDATE public.inventory_items
       SET quantity_on_hand = $1,
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE inventory_item_id = $3
       RETURNING *`,
      [quantityAfter, req.user.user_id, itemId],
    );

    const movement = await client.query(
      `INSERT INTO public.inventory_movements
       (
         inventory_item_id,
         clinic_id,
         movement_type,
         quantity_change,
         quantity_before,
         quantity_after,
         reason,
         reference_number,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        itemId,
        item.clinic_id,
        movementType,
        quantityChange,
        quantityBefore,
        quantityAfter,
        reason,
        referenceNumber,
        req.user.user_id,
      ],
    );

    await client.query("COMMIT");

    await createAuditLog({
      user_id: req.user.user_id,
      action: "RECORD_INVENTORY_MOVEMENT",
      module: "Clinic Inventory",
      description:
        `${movementType} recorded for ${item.item_name} at ` +
        `${item.clinic_name}. Quantity changed from ${quantityBefore} ` +
        `to ${quantityAfter}.`,
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Inventory stock movement recorded successfully.",
      item: updated.rows[0],
      movement: movement.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Record inventory movement error:", err.message);
    return res.status(500).json({
      error: "Unable to record the inventory movement.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
