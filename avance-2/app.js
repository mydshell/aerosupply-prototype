// Catálogo simulado en memoria
const PART_CATALOG = {
  "C156-2": "BOOT PITCH BEARING",
  "MS24693S273": "MACHINE SCREW",
  "NAS1329A06K75": "RIVET NUT",
  "S3432-A": "NUTPLATE",
  "C253001-0101": "LOCK ASSY - DOOR L/H",
  "MT106-3": "TUBE FUEL SAMPLE, GL5",
  "A4138": "RACE CONE BEARING"
};

let rowCount = 1;

// Control dinámico de Reason for Request
function handleReasonChange() {
  const reasonSelect = document.getElementById("reqReason");
  const otherWrapper = document.getElementById("otherReasonWrapper");
  const otherInput = document.getElementById("reqOtherReasonDetail");

  if (reasonSelect.value === "Other") {
    otherWrapper.style.display = "flex";
    otherInput.focus();
  } else {
    otherWrapper.style.display = "none";
    otherInput.value = "";
  }
}

// Estilos del toggle de Urgency
function toggleUrgencyStyle() {
  const urgency = document.querySelector('input[name="urgencyRadio"]:checked').value;
  const lblRoutine = document.getElementById("lblRoutine");
  const lblAOG = document.getElementById("lblAOG");

  if (urgency === "AOG") {
    lblAOG.className = "toggle-option active aog";
    lblRoutine.className = "toggle-option";
  } else {
    lblRoutine.className = "toggle-option active";
    lblAOG.className = "toggle-option";
  }
}

// Auto-completar descripción al escribir P/N
function lookupPartDescription(inputElement, rowId) {
  const pn = inputElement.value.trim().toUpperCase();
  const descInput = document.querySelector(`.input-desc[data-row="${rowId}"]`);

  if (PART_CATALOG[pn] && descInput) {
    descInput.value = PART_CATALOG[pn];
  }
}

// Agregar nueva línea de parte con su campo de notas horizontal
function addPartRow() {
  rowCount++;
  const tbody = document.getElementById("partsTableBody");

  const tr = document.createElement("tr");
  tr.id = `row-${rowCount}`;
  tr.className = "part-main-row";
  tr.innerHTML = `
    <td class="col-index">${rowCount}</td>
    <td>
      <input type="text" placeholder="e.g. MS24693S273" class="form-control mono uppercase input-pn" data-row="${rowCount}" onblur="lookupPartDescription(this, ${rowCount})">
    </td>
    <td>
      <input type="text" placeholder="Description or part name" class="form-control input-desc" data-row="${rowCount}">
    </td>
    <td>
      <input type="number" min="1" value="1" class="form-control mono text-center input-qty" data-row="${rowCount}">
    </td>
    <td>
      <input type="text" placeholder="Optional links, AMM ref, vendor..." class="form-control input-part-note" data-row="${rowCount}">
    </td>
    <td class="text-center">
      <button type="button" class="btn-icon btn-delete" onclick="handleRemoveRow(${rowCount})">
        <i class="fa-regular fa-trash-can"></i>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
}

// Eliminar fila
function handleRemoveRow(rowId) {
  const rows = document.querySelectorAll(".part-main-row");
  if (rows.length <= 1) {
    alert("At least one part line is required.");
    return;
  }
  const row = document.getElementById(`row-${rowId}`);
  if (row) row.remove();
}

// Reset básico
function resetForm() {
  location.reload();
}

// ==========================================================
// VALIDACIÓN DE DUPLICADOS Y SUBMIT (HU-001)
// ==========================================================
function validateAndSubmitRequest() {
  // 1. Obtener los elementos del formulario de forma segura
  const destSelect = document.getElementById("reqDestination");
  const reasonSelect = document.getElementById("reqReason");
  const otherInput = document.getElementById("reqOtherReasonDetail");

  const rawDestination = destSelect ? destSelect.value : "";
  const reason = reasonSelect ? reasonSelect.value : "";
  const otherDetail = otherInput ? otherInput.value.trim() : "";

  // 2. Validar detalle obligatorio si el motivo es "Other"
  if (reason === "Other" && !otherDetail) {
    alert("Please provide the specific reason for this request.");
    if (otherInput) otherInput.focus();
    return;
  }

  // 3. Obtener la fila de la parte que se está registrando
  const firstRow = document.querySelector(".part-main-row");
  if (!firstRow) return;

  const pnInput = firstRow.querySelector(".input-pn");
  const descInput = firstRow.querySelector(".input-desc");
  const qtyInput = firstRow.querySelector(".input-qty");

  const pn = pnInput ? pnInput.value.trim().toUpperCase() : "";
  const desc = descInput ? descInput.value.trim() : "";
  const qty = qtyInput ? parseInt(qtyInput.value, 10) : 0;

  if (!pn || !desc || isNaN(qty) || qty <= 0) {
    alert("Please enter a valid Part Number, Description, and Quantity (>0).");
    return;
  }

  // 4. Normalizar el destino para evitar fallos de coincidencia
  // Si dice algo como "Aircraft: C-GYBF (C172S)" extrae "C-GYBF"
  let targetTail = "C-GYBF";
  if (rawDestination.includes("STOCK")) {
    targetTail = "STOCK";
  } else if (rawDestination.includes("C-GYBF")) {
    targetTail = "C-GYBF";
  } else if (rawDestination) {
    targetTail = rawDestination;
  }

  // 5. Base de datos precargada de solicitudes abiertas
  let activeList = [
    { partNumber: "C253001-0101", tail: "C-GYBF", id: "REQ-2026-0839", status: "In Transit", date: "2026-10-14 14:20" },
    { partNumber: "AN507-1032R10", tail: "STOCK", id: "REQ-2026-0835", status: "Pending", date: "2026-10-15 09:12" },
    { partNumber: "S3432-A", tail: "C-GYBF", id: "REQ-2026-0810", status: "In Stock", location: "Bay 2 - Shelf B", date: "2026-10-04 11:30" }
  ];

  // 6. Leer dinámicamente todo lo que ya esté en la tabla de My Requisitions
  const tableRows = document.querySelectorAll("#requisitionsTableBody tr");
  tableRows.forEach(tr => {
    const cells = tr.querySelectorAll("td");
    if (cells.length >= 8) {
      const rowId = cells[0].innerText.trim();
      const rowDate = cells[1].innerText.trim();
      const rowTail = cells[2].innerText.trim();
      const rowPn = cells[3].innerText.trim().toUpperCase();
      const rowStatus = tr.getAttribute("data-status") || cells[7].innerText.trim();

      activeList.push({
        partNumber: rowPn,
        tail: rowTail,
        id: rowId,
        status: rowStatus,
        date: rowDate
      });
    }
  });

  // 7. Buscar si la pieza ya existe para el mismo avión o para stock
  const match = activeList.find(item => 
    item.partNumber === pn && (item.tail === targetTail || (targetTail === "STOCK" && item.tail === "STOCK"))
  );

  // 8. Manejo de alertas y bloqueos
  if (match) {
    if (match.status === "In Stock") {
      // Alerta preventiva: parte en almacén
      const warnMsg = document.getElementById("stockWarningMsg");
      const warnLoc = document.getElementById("warnLoc");
      const warnDate = document.getElementById("warnDate");

      if (warnMsg) warnMsg.innerHTML = `Part <strong>${pn}</strong> is already available at the hangar warehouse. Please verify before requesting.`;
      if (warnLoc) warnLoc.innerText = match.location || "Bay 2 - Shelf B";
      if (warnDate) warnDate.innerText = (match.date || "") + " UTC";

      openModal("modalStockWarning");
      return;
    } else {
      // Bloqueo estricto: requerimiento activo ya existente
      const blkMsg = document.getElementById("blockedActiveMsg");
      const blkId = document.getElementById("blkReqId");
      const blkTail = document.getElementById("blkTail");
      const blkStatus = document.getElementById("blkStatus");
      const blkDate = document.getElementById("blkDate");

      if (blkMsg) blkMsg.innerHTML = `An active request for part <strong>${pn}</strong> already exists for <strong>${targetTail}</strong> in status <strong>${match.status}</strong>.`;
      if (blkId) blkId.innerText = match.id;
      if (blkTail) blkTail.innerText = match.tail;
      if (blkStatus) blkStatus.innerText = match.status;
      if (blkDate) blkDate.innerText = (match.date || "") + " UTC";

      openModal("modalBlockedActive");
      return;
    }
  }

  // 9. Si pasa todas las validaciones, registrar con éxito
  triggerSuccessModal();
}
// ==========================================
// 2. MODAL DE ÉXITO Y ALERTA AOG (HU-001)
// ==========================================
function triggerSuccessModal() {
  const generatedId = "REQ-2026-" + Math.floor(1000 + Math.random() * 9000);
  const codeEl = document.getElementById("successReqId");
  if (codeEl) codeEl.innerText = generatedId;

  // Comprobar si la urgencia seleccionada es AOG
  const urgencyEl = document.querySelector('input[name="urgencyRadio"]:checked');
  const urgency = urgencyEl ? urgencyEl.value : "Routine";
  const aogBanner = document.getElementById("successAogAlert");

  if (aogBanner) {
    if (urgency === "AOG") {
      aogBanner.classList.remove("hidden");
    } else {
      aogBanner.classList.add("hidden");
    }
  }

  openModal("modalSuccess");
}

// Cierre de sesión simulado
function handleSignOut() {
  if (confirm("Are you sure you want to end your current session?")) {
    alert("Session closed successfully. Returning to login...");
    location.reload();
  }
}

// ==========================================
// CAMBIO DE VISTAS (PESTAÑAS)
// ==========================================
const navCreateBtn = document.getElementById("navCreateBtn");
const navVendorsBtn = document.getElementById("navVendorsBtn");
const navWarehouseBtn = document.getElementById("navWarehouseBtn");
const viewVendors = document.getElementById("viewVendors");
const viewWarehouse = document.getElementById("viewWarehouse");
const navMyReqsBtn = document.getElementById("navMyReqsBtn");
const navProcurementBtn = document.getElementById("navProcurementBtn");
const viewProcurement = document.getElementById("viewProcurement");
const viewCreate = document.getElementById("viewCreate");
const viewRequisitions = document.getElementById("viewRequisitions");
const viewTitle = document.getElementById("viewTitle");

function switchView(viewName) {
  [viewCreate, viewRequisitions, viewProcurement, viewVendors, viewWarehouse].forEach(v => {
    if (v) v.classList.add("hidden");
  });
  [navCreateBtn, navMyReqsBtn, navProcurementBtn, navVendorsBtn, navWarehouseBtn].forEach(btn => {
    if (btn) btn.classList.remove("active");
  });

  if (viewName === "create") {
    if (viewCreate) viewCreate.classList.remove("hidden");
    if (navCreateBtn) navCreateBtn.classList.add("active");
    if (viewTitle) viewTitle.innerText = "Create Request";
  } else if (viewName === "requisitions") {
    if (viewRequisitions) viewRequisitions.classList.remove("hidden");
    if (navMyReqsBtn) navMyReqsBtn.classList.add("active");
    if (viewTitle) viewTitle.innerText = "My Requisitions";
  } else if (viewName === "procurement") {
    if (viewProcurement) viewProcurement.classList.remove("hidden");
    if (navProcurementBtn) navProcurementBtn.classList.add("active");
    if (viewTitle) viewTitle.innerText = "Procurement & Quotes";
  } else if (viewName === "vendors") {
    if (viewVendors) viewVendors.classList.remove("hidden");
    if (navVendorsBtn) navVendorsBtn.classList.add("active");
    if (viewTitle) viewTitle.innerText = "Vendor Directory";
  } else if (viewName === "warehouse") {
    if (viewWarehouse) viewWarehouse.classList.remove("hidden");
    if (navWarehouseBtn) navWarehouseBtn.classList.add("active");
    if (viewTitle) viewTitle.innerText = "Warehouse Receiving";
    if (typeof refreshWarehouseReceivingTable === "function") refreshWarehouseReceivingTable();
  }
}

if (navCreateBtn) navCreateBtn.addEventListener("click", () => switchView("create"));
if (navMyReqsBtn) navMyReqsBtn.addEventListener("click", () => switchView("requisitions"));
if (navProcurementBtn) navProcurementBtn.addEventListener("click", () => switchView("procurement"));
if (navVendorsBtn) navVendorsBtn.addEventListener("click", () => switchView("vendors"));
if (navWarehouseBtn) navWarehouseBtn.addEventListener("click", () => switchView("warehouse"));

/* Legacy nav listeners disabled */
if (false) navCreateBtn.addEventListener("click", () => {
  viewCreate.classList.remove("hidden");
  viewRequisitions.classList.add("hidden");
  navCreateBtn.classList.add("active");
  navMyReqsBtn.classList.remove("active");
  if (viewProcurement) viewProcurement.classList.add("hidden");
  if (navProcurementBtn) navProcurementBtn.classList.remove("active");
  viewTitle.innerText = "Create Request";
});

if (false) navMyReqsBtn.addEventListener("click", () => {
  if (viewProcurement) viewProcurement.classList.add("hidden");
  if (navProcurementBtn) navProcurementBtn.classList.remove("active");
  viewCreate.classList.add("hidden");
  if (viewProcurement) viewProcurement.classList.add("hidden");
  if (navProcurementBtn) navProcurementBtn.classList.remove("active");
  viewRequisitions.classList.remove("hidden");
  navMyReqsBtn.classList.add("active");
  navCreateBtn.classList.remove("active");
  viewTitle.innerText = "My Requisitions";
});

// ==========================================
if (false && navProcurementBtn) {
  navProcurementBtn.addEventListener("click", () => {
    if (viewCreate) viewCreate.classList.add("hidden");
    if (viewRequisitions) viewRequisitions.classList.add("hidden");
    if (viewProcurement) viewProcurement.classList.remove("hidden");
    if (navCreateBtn) navCreateBtn.classList.remove("active");
    if (navMyReqsBtn) navMyReqsBtn.classList.remove("active");
    navProcurementBtn.classList.add("active");
    if (viewTitle) viewTitle.innerText = "Procurement & Quotes";
  });
}

// DRAWER LATERAL DE DETALLES (HU-002)
// ==========================================
function openDetailsDrawer(button) {
  const row = button.closest("tr");
  const id = row.getAttribute("data-id");
  const status = row.getAttribute("data-status");
  const carrier = row.getAttribute("data-carrier");
  const awb = row.getAttribute("data-awb");
  const eta = row.getAttribute("data-eta");
  const location = row.getAttribute("data-location");

  const cells = row.querySelectorAll("td");
  const dest = cells[2].innerText;
  const pn = cells[3].innerText;
  const desc = cells[4].innerText;

  // Cargar datos en el panel
  document.getElementById("drwId").innerText = id;
  document.getElementById("drwDest").innerText = dest;
  document.getElementById("drwPn").innerText = pn;
  document.getElementById("drwDesc").innerText = desc;
  document.getElementById("drwStatus").innerText = status;

  const transitCard = document.getElementById("drwTransitCard");
  const stockCard = document.getElementById("drwStockCard");

  // Mostrar tarjeta correspondiente según el estado
  if (status === "In Transit") {
    transitCard.classList.remove("hidden");
    stockCard.classList.add("hidden");
    document.getElementById("drwCarrier").innerText = carrier;
    document.getElementById("drwAwb").innerText = awb;
    document.getElementById("drwEta").innerText = eta;
  } else if (status === "In Stock") {
    transitCard.classList.add("hidden");
    stockCard.classList.remove("hidden");
    document.getElementById("drwLoc").innerText = location || "Main Hangar Bay";
  } else {
    transitCard.classList.add("hidden");
    stockCard.classList.add("hidden");
  }

  // Abrir panel
  document.getElementById("detailsDrawer").classList.remove("hidden");
}

function closeDetailsDrawer() {
  document.getElementById("detailsDrawer").classList.add("hidden");
}

// Filtrar por texto en tiempo real
function filterRequisitionsTable() {
  const query = document.getElementById("tableSearch").value.toLowerCase();
  const rows = document.querySelectorAll("#requisitionsTableBody tr");

  rows.forEach(r => {
    r.style.display = r.innerText.toLowerCase().includes(query) ? "" : "none";
  });
}

// Filtrar por botones de estado
function filterByStatus(status, button) {
  document.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
  button.classList.add("active");

  const rows = document.querySelectorAll("#requisitionsTableBody tr");
  rows.forEach(r => {
    if (status === "ALL" || r.getAttribute("data-status") === status) {
      r.style.display = "";
    } else {
      r.style.display = "none";
    }
  });
}

// ==========================================================
// VALIDACIÓN REACTIVA DEL BOTÓN DE GUARDADO (CRITERIO 1 HU-001)
// ==========================================================
function checkFormValidity() {
  const submitBtn = document.getElementById("btnSubmitRequest");
  if (!submitBtn) return;

  const reason = document.getElementById("reqReason").value;
  const otherDetail = document.getElementById("reqOtherReasonDetail").value.trim();

  // Si eligió "Other", el detalle es obligatorio
  if (reason === "Other" && !otherDetail) {
    submitBtn.disabled = true;
    return;
  }

  const rows = document.querySelectorAll(".part-main-row");
  if (rows.length === 0) {
    submitBtn.disabled = true;
    return;
  }

  let allValid = true;

  rows.forEach(r => {
    const pn = r.querySelector(".input-pn") ? r.querySelector(".input-pn").value.trim() : "";
    const desc = r.querySelector(".input-desc") ? r.querySelector(".input-desc").value.trim() : "";
    const qtyInput = r.querySelector(".input-qty");
    const qty = qtyInput ? parseInt(qtyInput.value, 10) : 0;

    // Part Number, Description obligatorios y Qty entero mayor que cero
    if (!pn || !desc || isNaN(qty) || qty <= 0) {
      allValid = false;
    }
  });

  submitBtn.disabled = !allValid;
}

// Escuchar cambios en todo el formulario en tiempo real
document.getElementById("viewCreate").addEventListener("input", checkFormValidity);
document.getElementById("viewCreate").addEventListener("change", checkFormValidity);

// ==========================================================
// CONTROL DE MODALES Y ÉXITO CON ALERTA AOG (CRITERIO 5 HU-001)
// ==========================================================
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("hidden");
}

function triggerSuccessModal() {
  const generatedId = "REQ-2026-" + Math.floor(1000 + Math.random() * 9000);
  const successReqIdEl = document.getElementById("successReqId");
  if (successReqIdEl) successReqIdEl.innerText = generatedId;

  // Evaluar si la urgencia es AOG (Criterio 5)
  const urgencySelected = document.querySelector('input[name="urgencyRadio"]:checked').value;
  const aogAlertBanner = document.getElementById("successAogAlert");

  if (urgencySelected === "AOG") {
    aogAlertBanner.classList.remove("hidden");
  } else {
    aogAlertBanner.classList.add("hidden");
  }

  openModal("modalSuccess");
}

// ==========================================================
// TRANSICIÓN A MY REQUISITIONS E INSERCIÓN DINÁMICA (UTC)
// ==========================================================
function handleGoToRequisitions() {
  // 1. Cerrar la modal de confirmación
  closeModal("modalSuccess");

  // 2. Extraer los datos registrados en el formulario
  const generatedId = document.getElementById("successReqId").innerText;
  const destination = document.getElementById("reqDestination").value;
  const urgency = document.querySelector('input[name="urgencyRadio"]:checked').value;

  const firstRow = document.querySelector(".part-main-row");
  const pn = firstRow.querySelector(".input-pn").value.trim().toUpperCase();
  const desc = firstRow.querySelector(".input-desc").value.trim();
  const qty = firstRow.querySelector(".input-qty").value;

  // 3. Generar la marca temporal en formato UTC
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 16).replace("T", " ");

  // 4. Crear e insertar la fila en la tabla de My Requisitions
  const tbody = document.getElementById("requisitionsTableBody");
  const tr = document.createElement("tr");
  tr.setAttribute("data-id", generatedId);
  tr.setAttribute("data-status", "Pending");
  tr.setAttribute("data-carrier", "N/A");
  tr.setAttribute("data-awb", "N/A");
  tr.setAttribute("data-eta", "Pending PO");

  tr.innerHTML = `
    <td class="col-id">${generatedId}</td>
    <td class="col-date">${utcDate}</td>
    <td class="col-target">${destination}</td>
    <td class="col-pn">${pn}</td>
    <td class="col-desc">${desc}</td>
    <td class="col-qty">${qty}</td>
    <td class="text-center"><span class="badge-urgency ${urgency === 'AOG' ? 'aog' : 'routine'}">${urgency}</span></td>
    <td class="text-center"><span class="badge-status pending">Pending</span></td>
    <td class="text-center">
      <button type="button" class="btn-table-action" onclick="openDetailsDrawer(this)">Details</button>
    </td>
  `;

  // Se añade al inicio de la tabla
  tbody.insertBefore(tr, tbody.firstChild);

  // 5. Cambiar a la vista de My Requisitions en la interfaz
  viewCreate.classList.add("hidden");
  if (viewProcurement) viewProcurement.classList.add("hidden");
  if (navProcurementBtn) navProcurementBtn.classList.remove("active");
  viewRequisitions.classList.remove("hidden");
  navMyReqsBtn.classList.add("active");
  navCreateBtn.classList.remove("active");
  viewTitle.innerText = "My Requisitions";
}

// ==========================================================
// TRANSICIÓN A MY REQUISITIONS, INSERCIÓN DINÁMICA Y RESET
// ==========================================================
function clearCreateForm() {
  // 1. Restablecer selector de destino y motivo
  document.getElementById("reqDestination").selectedIndex = 0;
  
  const reqReason = document.getElementById("reqReason");
  reqReason.selectedIndex = 0;
  handleReasonChange(); // Oculta el campo condicional de detalle

  // 2. Restablecer Urgencia a Routine
  const routineRadio = document.querySelector('input[name="urgencyRadio"][value="Routine"]');
  if (routineRadio) {
    routineRadio.checked = true;
    toggleUrgencyStyle();
  }

  // 3. Dejar la tabla de partes con una sola fila limpia
  const tbody = document.getElementById("partsTableBody");
  rowCount = 1;
  tbody.innerHTML = `
    <tr id="row-1" class="part-main-row">
      <td class="col-index">1</td>
      <td>
        <input type="text" placeholder="e.g. C156-2" class="form-control mono uppercase input-pn" data-row="1" onblur="lookupPartDescription(this, 1)">
      </td>
      <td>
        <input type="text" placeholder="Description or part name" class="form-control input-desc" data-row="1">
      </td>
      <td>
        <input type="number" min="1" value="1" class="form-control mono text-center input-qty" data-row="1">
      </td>
      <td>
        <input type="text" placeholder="Optional links, AMM ref, vendor..." class="form-control input-part-note" data-row="1">
      </td>
      <td class="text-center">
        <button type="button" class="btn-icon btn-delete" onclick="handleRemoveRow(1)">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `;

  // 4. Volver a evaluar la validez para que el botón Submit quede deshabilitado
  checkFormValidity();
}

// Variable global para recordar qué fila se está editando o eliminando
let currentTargetRow = null;

// ==========================================================
// TRANSICIÓN A MY REQUISITIONS CON BOTONES DE ACCIÓN (HU-002)
// ==========================================================
function handleGoToRequisitions() {
  closeModal("modalSuccess");

  const generatedId = document.getElementById("successReqId").innerText;
  const destination = document.getElementById("reqDestination").value;
  const urgency = document.querySelector('input[name="urgencyRadio"]:checked').value;

  const firstRow = document.querySelector(".part-main-row");
  const pn = firstRow.querySelector(".input-pn").value.trim().toUpperCase();
  const desc = firstRow.querySelector(".input-desc").value.trim();
  const qty = firstRow.querySelector(".input-qty").value;

  const now = new Date();
  const utcDate = now.toISOString().slice(0, 16).replace("T", " ");

  const tbody = document.getElementById("requisitionsTableBody");
  const tr = document.createElement("tr");
  tr.setAttribute("data-id", generatedId);
  tr.setAttribute("data-status", "Pending");
  tr.setAttribute("data-carrier", "N/A");
  tr.setAttribute("data-awb", "N/A");
  tr.setAttribute("data-eta", "Pending PO");

  // Al nacer en estado "Pending", incluye los botones de Details, Edit y Cancel
  tr.innerHTML = `
    <td class="col-id">${generatedId}</td>
    <td class="col-date">${utcDate}</td>
    <td class="col-target">${destination}</td>
    <td class="col-pn">${pn}</td>
    <td class="col-desc">${desc}</td>
    <td class="col-qty">${qty}</td>
    <td class="text-center"><span class="badge-urgency ${urgency === 'AOG' ? 'aog' : 'routine'}">${urgency}</span></td>
    <td class="text-center"><span class="badge-status pending">Pending</span></td>
    <td class="text-center">
      <div class="table-actions-cell">
        <button type="button" class="btn-table-action" onclick="openDetailsDrawer(this)" title="View Details">Details</button>
        <button type="button" class="btn-icon-action btn-edit-action" onclick="openEditModal(this)" title="Edit Request">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button type="button" class="btn-icon-action btn-delete-action" onclick="openDeleteModal(this)" title="Cancel Request">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    </td>
  `;

  tbody.insertBefore(tr, tbody.firstChild);

  // Limpiar formulario y cambiar vista
  clearCreateForm();
  switchView("requisitions");
  return;

  viewCreate.classList.add("hidden");
  if (viewProcurement) viewProcurement.classList.add("hidden");
  if (navProcurementBtn) navProcurementBtn.classList.remove("active");
  viewRequisitions.classList.remove("hidden");
  navMyReqsBtn.classList.add("active");
  navCreateBtn.classList.remove("active");
  viewTitle.innerText = "My Requisitions";
}

// ==========================================================
// ACCIÓN: EDITAR REQUERIMIENTO (QUANTITY Y URGENCY)
// ==========================================================
function openEditModal(button) {
  currentTargetRow = button.closest("tr");
  const cells = currentTargetRow.querySelectorAll("td");

  const reqId = cells[0].innerText.trim();
  const pn = cells[3].innerText.trim();
  const currentQty = parseInt(cells[5].innerText.trim(), 10);
  const currentUrgency = cells[6].innerText.trim();

  document.getElementById("editReqId").innerText = reqId;
  document.getElementById("editPn").innerText = pn;
  document.getElementById("editQtyInput").value = currentQty;

  if (currentUrgency === "AOG") {
    document.getElementById("editUrgAog").checked = true;
  } else {
    document.getElementById("editUrgRoutine").checked = true;
  }

  openModal("modalEditReq");
}

function confirmSaveEdit() {
  if (!currentTargetRow) return;

  const newQty = parseInt(document.getElementById("editQtyInput").value, 10);
  if (isNaN(newQty) || newQty <= 0) {
    alert("Quantity must be a valid number greater than zero.");
    return;
  }

  const newUrgency = document.querySelector('input[name="editUrgencyRadio"]:checked').value;
  const cells = currentTargetRow.querySelectorAll("td");

  // Actualizar Quantity en la celda
  cells[5].innerText = newQty;

  // Actualizar Urgency Badge en la celda
  cells[6].innerHTML = `<span class="badge-urgency ${newUrgency === 'AOG' ? 'aog' : 'routine'}">${newUrgency}</span>`;

  closeModal("modalEditReq");
}

// ==========================================================
// ACCIÓN: ELIMINAR / CANCELAR CON MOTIVO OBLIGATORIO
// ==========================================================
function openDeleteModal(button) {
  currentTargetRow = button.closest("tr");
  const cells = currentTargetRow.querySelectorAll("td");

  const reqId = cells[0].innerText.trim();
  const target = cells[2].innerText.trim();

  document.getElementById("deleteReqId").innerText = reqId;
  document.getElementById("deleteTarget").innerText = target;
  document.getElementById("deleteReasonInput").value = "";

  openModal("modalDeleteReq");
}

function confirmDeleteRequisition() {
  if (!currentTargetRow) return;

  const reason = document.getElementById("deleteReasonInput").value.trim();
  if (!reason) {
    alert("Please provide the formal technical or operational reason for cancelling this requisition.");
    document.getElementById("deleteReasonInput").focus();
    return;
  }

  // Eliminar la fila de la vista
  currentTargetRow.remove();
  currentTargetRow = null;

  closeModal("modalDeleteReq");
}


// =============================================================================
// MÓDULO: PROCUREMENT & QUOTES (HU-004, HU-005, HU-006)
// =============================================================================

// Catálogo de cotizaciones dummy de proveedores certificados
const QUOTES_DATA = [
  {
    id: 0,
    vendor: "Boeing Distribution Inc.",
    unitPrice: 1680.00,
    freight: 120.00,
    leadTime: "1 Day (AOG)",
    currency: "USD",
    sub: "FAA-AC 00-56B • Stock: Miami (MIA)"
  },
  {
    id: 1,
    vendor: "Aviall Services",
    unitPrice: 1420.00,
    freight: 85.00,
    leadTime: "3 Days",
    currency: "USD",
    sub: "EASA.145.0210 • Stock: Dallas (DFW)"
  },
  {
    id: 2,
    vendor: "AeroPrecision Supplies",
    unitPrice: 1850.00,
    freight: 65.00,
    leadTime: "2 Days",
    currency: "USD",
    sub: "OEM Factory Direct • Toronto (YYZ)"
  },
  {
    id: 3,
    vendor: "Dallas Airmotive Parts",
    unitPrice: 1290.00,
    freight: 95.00,
    leadTime: "5 Days",
    currency: "USD",
    sub: "ISO 9001:2015 • Atlanta (ATL)"
  }
];

// Estado centralizado del flujo de compras
const procurementState = {
  urgency: "AOG",
  selectedQuote: null,
  approvalStatus: null,
  rejectionReason: "",
  poGenerated: false,
  poNumber: ""
};

// =============================================================================
// HU-004: SELECCIONAR COTIZACIÓN (QUOTES COMPARISON)
// =============================================================================
function selectQuote(quoteIndex) {
  const quote = QUOTES_DATA[quoteIndex];
  if (!quote) return;

  procurementState.selectedQuote = quote;
  procurementState.approvalStatus = null;
  procurementState.rejectionReason = "";
  procurementState.poGenerated = false;

  // 1. Resaltar fila seleccionada en la tabla
  document.querySelectorAll("#quotesTableBody tr").forEach(row => {
    row.classList.remove("quote-row-selected");
    const btn = row.querySelector(".btn-select-quote");
    if (btn) {
      btn.innerHTML = `<i class="fa-regular fa-circle-check"></i> Select Quote`;
    }
  });

  const selectedRow = document.getElementById(`quote-row-${quoteIndex}`);
  if (selectedRow) {
    selectedRow.classList.add("quote-row-selected");
    const btn = selectedRow.querySelector(".btn-select-quote");
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Selected`;
    }
  }

  // 2. Poblar resumen de cotización en la sección de aprobación
  const totalCost = quote.unitPrice + quote.freight;
  const vendorEl = document.getElementById("summaryVendorName");
  const unitPriceEl = document.getElementById("summaryUnitPrice");
  const freightEl = document.getElementById("summaryFreight");
  const leadTimeEl = document.getElementById("summaryLeadTime");
  const totalCostEl = document.getElementById("summaryTotalCost");

  if (vendorEl) vendorEl.innerText = quote.vendor;
  if (unitPriceEl) unitPriceEl.innerText = `$${quote.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${quote.currency}`;
  if (freightEl) freightEl.innerText = `$${quote.freight.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${quote.currency}`;
  if (leadTimeEl) leadTimeEl.innerText = quote.leadTime;
  if (totalCostEl) totalCostEl.innerText = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${quote.currency}`;

  // 3. Evaluar Reglas de Negocio (HU-005): Costo > $1500 USD O Urgencia "AOG"
  evaluateApprovalPolicy(totalCost);

  // 4. Revelar sección de Aprobación de Gerencia
  const approvalSection = document.getElementById("cardManagerApproval");
  if (approvalSection) approvalSection.classList.remove("hidden");

  // Ocultar sección de PO hasta nueva aprobación
  const poSection = document.getElementById("cardPurchaseOrder");
  if (poSection) poSection.classList.add("hidden");

  // Limpiar feedback de rechazo previo y restaurar botones
  const feedbackCard = document.getElementById("rejectionFeedbackCard");
  const actionsToolbar = document.getElementById("approvalActionsToolbar");
  if (feedbackCard) feedbackCard.classList.add("hidden");
  if (actionsToolbar) actionsToolbar.classList.remove("hidden");

  const btnApprove = document.getElementById("btnApproveQuote");
  const btnReject = document.getElementById("btnRejectQuote");
  if (btnApprove) {
    btnApprove.disabled = false;
    btnApprove.innerHTML = `<i class="fa-solid fa-check"></i> Approve`;
  }
  if (btnReject) btnReject.disabled = false;

  // Desplazamiento suave hacia la sección de aprobación
  if (approvalSection) {
    approvalSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// =============================================================================
// HU-005: EVALUACIÓN DE GOBERNANZA Y POLÍTICA DE APROBACIÓN
// =============================================================================
function evaluateApprovalPolicy(totalCost) {
  // Criterio: Total Cost > $1500 USD OR Urgency == "AOG"
  const isOverThreshold = totalCost > 1500;
  const isAOG = procurementState.urgency === "AOG";
  const requiresManagerApproval = isOverThreshold || isAOG;

  const badgeContainer = document.getElementById("approvalStatusBadgeContainer");
  const workflowBadge = document.getElementById("procWorkflowBadge");
  const alertTitle = document.getElementById("alertPolicyTitle");
  const alertReason = document.getElementById("alertPolicyReason");
  const alertBanner = document.getElementById("approvalPolicyAlert");

  if (requiresManagerApproval) {
    procurementState.approvalStatus = "Pending Manager Approval";

    if (badgeContainer) {
      badgeContainer.innerHTML = `
        <span class="badge-status pending" id="approvalStatusBadge">
          <i class="fa-solid fa-clock"></i> Pending Manager Approval
        </span>
      `;
    }

    if (workflowBadge) {
      workflowBadge.className = "badge-status-lg status-step-approval";
      workflowBadge.innerHTML = `<i class="fa-solid fa-clock"></i> Pending Manager Approval`;
    }

    if (alertBanner) alertBanner.classList.remove("hidden");
    if (alertTitle) alertTitle.innerText = "Manager Approval Mandatory";

    if (alertReason) {
      if (isOverThreshold && isAOG) {
        alertReason.innerText = `Policy Trigger: Total landed cost ($${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD) exceeds the $1,500.00 threshold AND maintenance urgency is flagged as critical AOG.`;
      } else if (isOverThreshold) {
        alertReason.innerText = `Financial Limit Policy: Total landed cost ($${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD) exceeds the delegation threshold of $1,500.00 USD.`;
      } else {
        alertReason.innerText = `Urgency Governance Policy: Operational status is set to AOG (Aircraft On Ground), which mandates formal managerial authorization.`;
      }
    }
  } else {
    // Si no supera $1500 y es Rutina
    procurementState.approvalStatus = "Routine Authorization";

    if (badgeContainer) {
      badgeContainer.innerHTML = `
        <span class="badge-status instock" id="approvalStatusBadge">
          <i class="fa-solid fa-shield-halved"></i> Routine Pre-Authorization (<$1,500)
        </span>
      `;
    }

    if (workflowBadge) {
      workflowBadge.className = "badge-status-lg status-step-quoting";
      workflowBadge.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> Standard Approval`;
    }

    if (alertBanner) alertBanner.classList.remove("hidden");
    if (alertTitle) alertTitle.innerText = "Within Standard Expenditure Limit";
    if (alertReason) {
      alertReason.innerText = `Total expenditure ($${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD) is under the $1,500.00 limit with Routine urgency. Manager may verify and authorize to issue the Purchase Order.`;
    }
  }
}

// =============================================================================
// HU-005: ACCIONES DE GERENCIA (APPROVE / REJECT)
// =============================================================================
function handleApproveQuote() {
  if (!procurementState.selectedQuote) return;

  procurementState.approvalStatus = "Approved";

  // Actualizar Badge en la sección de aprobación a "Approved"
  const badgeContainer = document.getElementById("approvalStatusBadgeContainer");
  if (badgeContainer) {
    badgeContainer.innerHTML = `
      <span class="badge-status approved" id="approvalStatusBadge">
        <i class="fa-solid fa-circle-check"></i> Approved
      </span>
    `;
  }

  // Actualizar Badge en la barra de flujo superior
  const workflowBadge = document.getElementById("procWorkflowBadge");
  if (workflowBadge) {
    workflowBadge.className = "badge-status-lg status-step-approved";
    workflowBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Quote Approved`;
  }

  // Inhabilitar botones de aprobación para reflejar decisión tomada
  const btnApprove = document.getElementById("btnApproveQuote");
  const btnReject = document.getElementById("btnRejectQuote");
  if (btnApprove) {
    btnApprove.disabled = true;
    btnApprove.innerHTML = `<i class="fa-solid fa-check-double"></i> Approved by Manager`;
  }
  if (btnReject) btnReject.disabled = true;

  // HU-006: Revelar la tarjeta de Orden de Compra (PO)
  revealPurchaseOrderSection();
}

function openRejectQuoteModal() {
  if (!procurementState.selectedQuote) return;

  const totalCost = procurementState.selectedQuote.unitPrice + procurementState.selectedQuote.freight;
  const vendorEl = document.getElementById("rejectModalVendor");
  const totalEl = document.getElementById("rejectModalTotal");

  if (vendorEl) vendorEl.innerText = procurementState.selectedQuote.vendor;
  if (totalEl) totalEl.innerText = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;

  // Limpiar campos previos y mensajes de error
  const reasonInput = document.getElementById("rejectionReasonInput");
  const errorMsg = document.getElementById("rejectionErrorText");
  if (reasonInput) reasonInput.value = "";
  if (errorMsg) errorMsg.classList.add("hidden");

  openModal("modalRejectQuote");
  if (reasonInput) reasonInput.focus();
}

function confirmRejectQuote() {
  const reasonInput = document.getElementById("rejectionReasonInput");
  const errorMsg = document.getElementById("rejectionErrorText");
  const reason = reasonInput ? reasonInput.value.trim() : "";

  // Validación estricta: Motivo obligatorio
  if (!reason) {
    if (errorMsg) errorMsg.classList.remove("hidden");
    if (reasonInput) reasonInput.focus();
    return;
  }

  procurementState.approvalStatus = "Rejected";
  procurementState.rejectionReason = reason;

  closeModal("modalRejectQuote");

  // Actualizar Badge a "Rejected"
  const badgeContainer = document.getElementById("approvalStatusBadgeContainer");
  if (badgeContainer) {
    badgeContainer.innerHTML = `
      <span class="badge-status rejected" id="approvalStatusBadge">
        <i class="fa-solid fa-circle-xmark"></i> Rejected
      </span>
    `;
  }

  // Actualizar Workflow Badge en la cabecera
  const workflowBadge = document.getElementById("procWorkflowBadge");
  if (workflowBadge) {
    workflowBadge.className = "badge-status-lg status-step-rejected";
    workflowBadge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Quote Rejected`;
  }

  // Ocultar barra de botones y mostrar feedback con la razón estipulada
  const toolbar = document.getElementById("approvalActionsToolbar");
  const feedbackCard = document.getElementById("rejectionFeedbackCard");
  const feedbackText = document.getElementById("rejectionFeedbackText");

  if (toolbar) toolbar.classList.add("hidden");
  if (feedbackText) feedbackText.innerText = `"${reason}"`;
  if (feedbackCard) feedbackCard.classList.remove("hidden");

  // Bloquear/Ocultar sección de PO
  const poSection = document.getElementById("cardPurchaseOrder");
  if (poSection) poSection.classList.add("hidden");
}

function resetQuoteSelection() {
  // Restaurar barra de acciones para reevaluar cotización
  const toolbar = document.getElementById("approvalActionsToolbar");
  const feedbackCard = document.getElementById("rejectionFeedbackCard");
  if (toolbar) toolbar.classList.remove("hidden");
  if (feedbackCard) feedbackCard.classList.add("hidden");

  const btnApprove = document.getElementById("btnApproveQuote");
  const btnReject = document.getElementById("btnRejectQuote");
  if (btnApprove) {
    btnApprove.disabled = false;
    btnApprove.innerHTML = `<i class="fa-solid fa-check"></i> Approve`;
  }
  if (btnReject) btnReject.disabled = false;

  // Desplazar hacia la tabla de cotizaciones para seleccionar otro proveedor
  const quotesTable = document.getElementById("cardQuotesComparison");
  if (quotesTable) quotesTable.scrollIntoView({ behavior: "smooth" });
}

// =============================================================================
// HU-006: EMISIÓN DE ORDEN DE COMPRA (PURCHASE ORDER)
// =============================================================================
function revealPurchaseOrderSection() {
  const poSection = document.getElementById("cardPurchaseOrder");
  if (!poSection) return;

  poSection.classList.remove("hidden");

  const quote = procurementState.selectedQuote;
  const totalCost = quote.unitPrice + quote.freight;

  // Sugerir número de PO automáticamente con prefijo corporativo
  const autoPoNumber = "PO-2026-" + Math.floor(1000 + Math.random() * 9000);
  const poNumberInput = document.getElementById("poNumberInput");
  const poVendorDisplay = document.getElementById("poVendorDisplay");
  const poAmountDisplay = document.getElementById("poTotalAmountDisplay");
  const poPaymentSelect = document.getElementById("poPaymentMethod");

  if (poNumberInput) {
    poNumberInput.value = autoPoNumber;
    poNumberInput.disabled = false;
  }
  if (poVendorDisplay) poVendorDisplay.value = quote.vendor;
  if (poAmountDisplay) poAmountDisplay.value = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
  if (poPaymentSelect) {
    poPaymentSelect.selectedIndex = 0;
    poPaymentSelect.disabled = false;
  }

  // Estado inicial del badge en la tarjeta de PO
  const poBadgeContainer = document.getElementById("poStatusBadgeContainer");
  if (poBadgeContainer) {
    poBadgeContainer.innerHTML = `
      <span class="badge-status-outline" id="poStatusBadge">
        <i class="fa-solid fa-file-signature"></i> Ready to Issue
      </span>
    `;
  }

  // Habilitar botón de generación
  const btnPO = document.getElementById("btnGeneratePO");
  if (btnPO) {
    btnPO.disabled = false;
    btnPO.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Generate &amp; Send PO`;
  }

  poSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function handleGeneratePO() {
  const poNumberInput = document.getElementById("poNumberInput");
  const poPaymentSelect = document.getElementById("poPaymentMethod");

  const poNumber = poNumberInput ? poNumberInput.value.trim() : "";
  const paymentMethod = poPaymentSelect ? poPaymentSelect.value : "";

  // 1. Validaciones
  if (!poNumber) {
    alert("Please enter a valid Purchase Order (PO) Number.");
    if (poNumberInput) poNumberInput.focus();
    return;
  }

  if (!paymentMethod) {
    alert("Please select a Payment Method (Corporate Card, Net 30, or Wire Transfer).");
    if (poPaymentSelect) poPaymentSelect.focus();
    return;
  }

  procurementState.poGenerated = true;
  procurementState.poNumber = poNumber;

  // 2. Criterio HU-006: Cambiar badge de estado visual a "Purchased"
  const poBadgeContainer = document.getElementById("poStatusBadgeContainer");
  if (poBadgeContainer) {
    poBadgeContainer.innerHTML = `
      <span class="badge-status purchased" id="poStatusBadge">
        <i class="fa-solid fa-check-double"></i> Purchased
      </span>
    `;
  }

  // Actualizar Workflow Badge en la cabecera
  const workflowBadge = document.getElementById("procWorkflowBadge");
  if (workflowBadge) {
    workflowBadge.className = "badge-status-lg status-step-purchased";
    workflowBadge.innerHTML = `<i class="fa-solid fa-check-double"></i> Purchased`;
  }

  // 3. Bloquear campos del formulario para prevenir doble envío
  if (poNumberInput) poNumberInput.disabled = true;
  if (poPaymentSelect) poPaymentSelect.disabled = true;

  const btnPO = document.getElementById("btnGeneratePO");
  if (btnPO) {
    btnPO.disabled = true;
    btnPO.innerHTML = `<i class="fa-solid fa-circle-check"></i> PO Dispatched`;
  }

  // 4. Mostrar alerta / modal de éxito con los datos despachados
  const quote = procurementState.selectedQuote;
  const totalCost = quote ? quote.unitPrice + quote.freight : 0;

  const displayNum = document.getElementById("poSuccessDisplayNumber");
  const displayVendor = document.getElementById("poSuccessVendor");
  const displayPayment = document.getElementById("poSuccessPayment");
  const displayAmount = document.getElementById("poSuccessAmount");

  if (displayNum) displayNum.innerText = poNumber;
  if (displayVendor) displayVendor.innerText = quote ? quote.vendor : "--";
  if (displayPayment) displayPayment.innerText = paymentMethod;
  if (displayAmount) displayAmount.innerText = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;

  // Sincronizar estado en la tabla de My Requisitions
  const targetReqRow = document.querySelector('#requisitionsTableBody tr[data-id="REQ-2026-0839"]');
  if (targetReqRow) {
    targetReqRow.setAttribute("data-status", "Purchased");
    const cells = targetReqRow.querySelectorAll("td");
    if (cells.length >= 8) {
      cells[7].innerHTML = `<span class="badge-status purchased">Purchased</span>`;
      cells[8].innerHTML = `
        <div class="table-actions-cell">
          <button type="button" class="btn-table-action btn-dispatch-action" onclick="openDispatchModal(this)" title="Register Logistics Dispatch">
            <i class="fa-solid fa-truck-ramp-box"></i> Dispatch
          </button>
          <button type="button" class="btn-table-action" onclick="openDetailsDrawer(this)" title="View Details">Details</button>
        </div>
      `;
    }
  }

  openModal("modalPoSuccess");
}

function resetProcurementFlow() {
  procurementState.selectedQuote = null;
  procurementState.approvalStatus = null;
  procurementState.rejectionReason = "";
  procurementState.poGenerated = false;

  // Desmarcar filas de cotización
  document.querySelectorAll("#quotesTableBody tr").forEach(row => {
    row.classList.remove("quote-row-selected");
    const btn = row.querySelector(".btn-select-quote");
    if (btn) btn.innerHTML = `<i class="fa-regular fa-circle-check"></i> Select Quote`;
  });

  // Ocultar tarjetas de aprobación y de PO
  const cardApproval = document.getElementById("cardManagerApproval");
  const cardPO = document.getElementById("cardPurchaseOrder");
  const feedbackCard = document.getElementById("rejectionFeedbackCard");
  const toolbar = document.getElementById("approvalActionsToolbar");

  if (cardApproval) cardApproval.classList.add("hidden");
  if (cardPO) cardPO.classList.add("hidden");
  if (feedbackCard) feedbackCard.classList.add("hidden");
  if (toolbar) toolbar.classList.remove("hidden");

  // Restaurar badge del workflow a Quoting
  const workflowBadge = document.getElementById("procWorkflowBadge");
  if (workflowBadge) {
    workflowBadge.className = "badge-status-lg status-step-quoting";
    workflowBadge.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> Comparing Quotes`;
  }

  // Restaurar inputs de PO
  const poNumberInput = document.getElementById("poNumberInput");
  const poPaymentSelect = document.getElementById("poPaymentMethod");
  if (poNumberInput) poNumberInput.disabled = false;
  if (poPaymentSelect) poPaymentSelect.disabled = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Utilidad interactiva para alternar la urgencia y verificar las reglas de negocio
function toggleRequisitionUrgency() {
  const urgencyBadge = document.getElementById("procUrgencyBadge");
  const btnToggle = document.getElementById("btnToggleUrgency");

  if (procurementState.urgency === "AOG") {
    procurementState.urgency = "Routine";
    if (urgencyBadge) {
      urgencyBadge.className = "badge-urgency routine";
      urgencyBadge.innerHTML = `<i class="fa-regular fa-clock"></i> Routine`;
    }
    if (btnToggle) {
      btnToggle.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Switch to AOG`;
    }
  } else {
    procurementState.urgency = "AOG";
    if (urgencyBadge) {
      urgencyBadge.className = "badge-urgency aog";
      urgencyBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> AOG`;
    }
    if (btnToggle) {
      btnToggle.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Switch to Routine`;
    }
  }

  // Si ya hay una cotización seleccionada, re-evaluar la política en tiempo real
  if (procurementState.selectedQuote && !procurementState.poGenerated && procurementState.approvalStatus !== "Rejected") {
    const totalCost = procurementState.selectedQuote.unitPrice + procurementState.selectedQuote.freight;
    evaluateApprovalPolicy(totalCost);
  }
}


// =============================================================================
// MÓDULO: VENDOR DIRECTORY (HU-003)
// =============================================================================

let currentVendorStatusFilter = "ALL";

function filterVendors() {
  const query = (document.getElementById("vendorSearchInput")?.value || "").toLowerCase().trim();
  const cards = document.querySelectorAll("#vendorsGrid .vendor-card");

  cards.forEach(card => {
    const name = (card.getAttribute("data-vendor-name") || "").toLowerCase();
    const code = (card.getAttribute("data-vendor-code") || "").toLowerCase();
    const location = (card.getAttribute("data-vendor-location") || "").toLowerCase();
    const status = card.getAttribute("data-vendor-status") || "Active";

    const matchesQuery = !query || name.includes(query) || code.includes(query) || location.includes(query);
    const matchesStatus = (currentVendorStatusFilter === "ALL") || (status === currentVendorStatusFilter);

    if (matchesQuery && matchesStatus) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });
}

function filterVendorsByStatus(status, button) {
  currentVendorStatusFilter = status;
  document.querySelectorAll("#viewVendors .btn-filter").forEach(btn => btn.classList.remove("active"));
  if (button) button.classList.add("active");
  filterVendors();
}


// =============================================================================
// MÓDULO: LOGISTICS DISPATCH (HU-007)
// =============================================================================

let currentDispatchRow = null;

function openDispatchModal(button) {
  currentDispatchRow = button.closest("tr");
  if (!currentDispatchRow) return;

  const cells = currentDispatchRow.querySelectorAll("td");
  const reqId = currentDispatchRow.getAttribute("data-id") || cells[0].innerText.trim();
  const target = currentDispatchRow.getAttribute("data-target") || cells[2].innerText.trim();
  const pn = currentDispatchRow.getAttribute("data-pn") || cells[3].innerText.trim();

  document.getElementById("dispReqId").innerText = reqId;
  document.getElementById("dispPn").innerText = pn;
  document.getElementById("dispTarget").innerText = target;

  const carrierSelect = document.getElementById("dispCarrierSelect");
  const awbInput = document.getElementById("dispAwbInput");
  const errorText = document.getElementById("dispErrorText");

  if (carrierSelect) carrierSelect.selectedIndex = 0;
  if (awbInput) awbInput.value = "";
  if (errorText) errorText.classList.add("hidden");

  openModal("modalLogisticsDispatch");
}

function autoGenerateAwb() {
  const carrierSelect = document.getElementById("dispCarrierSelect");
  if (carrierSelect && carrierSelect.selectedIndex === 0) {
    carrierSelect.value = "FedEx";
  }
  const prefix = Math.floor(1000 + Math.random() * 9000);
  const mid = Math.floor(1000 + Math.random() * 9000);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const generatedAwb = `${prefix}-${mid}-${suffix}`;
  
  const awbInput = document.getElementById("dispAwbInput");
  if (awbInput) awbInput.value = generatedAwb;
}

function confirmLogisticsDispatch() {
  if (!currentDispatchRow) return;

  const carrierSelect = document.getElementById("dispCarrierSelect");
  const awbInput = document.getElementById("dispAwbInput");
  const errorText = document.getElementById("dispErrorText");

  const carrier = carrierSelect ? carrierSelect.value : "";
  const awb = awbInput ? awbInput.value.trim() : "";

  if (!carrier || !awb) {
    if (errorText) errorText.classList.remove("hidden");
    return;
  }

  // 1. Actualizar atributos de datos de la fila
  currentDispatchRow.setAttribute("data-status", "In Transit");
  currentDispatchRow.setAttribute("data-carrier", carrier);
  currentDispatchRow.setAttribute("data-awb", awb);
  currentDispatchRow.setAttribute("data-eta", "Estimated 24-48h");

  // 2. Actualizar badge de estado a "In Transit"
  const cells = currentDispatchRow.querySelectorAll("td");
  if (cells.length >= 8) {
    cells[7].innerHTML = `<span class="badge-status transit">In Transit</span>`;
  }

  // 3. Ocultar / remover el botón de Dispatch Carrier de la celda de acción
  const dispatchBtn = currentDispatchRow.querySelector(".btn-dispatch-action");
  if (dispatchBtn) {
    dispatchBtn.remove();
  }

  closeModal("modalLogisticsDispatch");

  // 4. Mostrar alerta de éxito
  const reqId = currentDispatchRow.getAttribute("data-id") || "Requisition";
  alert(`✓ Logistics Dispatch Confirmed!\n\nShipment for ${reqId} has been booked with ${carrier}.\nAWB Tracking: ${awb}\nStatus updated to: In Transit.`);

  // 5. Refrescar la tabla de recepción de almacén (HU-008)
  refreshWarehouseReceivingTable();
}


// =============================================================================
// MÓDULO: WAREHOUSE RECEIVING (HU-008)
// =============================================================================

let currentInspectionRow = null;

function refreshWarehouseReceivingTable() {
  const tbody = document.getElementById("warehouseTableBody");
  if (!tbody) return;

  // Limpiar contenido anterior
  tbody.innerHTML = "";

  // Escanear todas las filas que estén "In Transit" en el sistema
  const reqRows = document.querySelectorAll("#requisitionsTableBody tr");
  let inTransitCount = 0;

  reqRows.forEach(row => {
    const status = row.getAttribute("data-status") || "";
    if (status === "In Transit") {
      inTransitCount++;
      const cells = row.querySelectorAll("td");

      const reqId = row.getAttribute("data-id") || (cells[0] ? cells[0].innerText.trim() : "");
      const target = cells[2] ? cells[2].innerText.trim() : "STOCK";
      const pn = cells[3] ? cells[3].innerText.trim() : "";
      const desc = cells[4] ? cells[4].innerText.trim() : "";
      const qty = cells[5] ? cells[5].innerText.trim() : "1";
      const urgency = cells[6] ? cells[6].innerText.trim() : "Routine";
      const carrier = row.getAttribute("data-carrier") || "FedEx Aviation";
      const awb = row.getAttribute("data-awb") || "N/A";

      const tr = document.createElement("tr");
      tr.setAttribute("data-id", reqId);
      tr.setAttribute("data-pn", pn);
      tr.setAttribute("data-desc", desc);
      tr.setAttribute("data-target", target);
      tr.setAttribute("data-qty", qty);
      tr.setAttribute("data-carrier", carrier);
      tr.setAttribute("data-awb", awb);
      tr.setAttribute("data-urgency", urgency);

      tr.innerHTML = `
        <td class="col-id">${reqId}</td>
        <td>
          <div class="carrier-cell">
            <strong>${carrier}</strong>
            <span class="awb-sub mono">${awb}</span>
          </div>
        </td>
        <td class="col-target">${target}</td>
        <td class="col-pn">${pn}</td>
        <td class="col-desc">${desc}</td>
        <td class="col-qty">${qty}</td>
        <td class="text-center"><span class="badge-urgency ${urgency === 'AOG' ? 'aog' : 'routine'}">${urgency}</span></td>
        <td class="text-center"><span class="badge-status transit">In Transit</span></td>
        <td class="text-center">
          <button type="button" class="btn-table-action btn-inspect-action" onclick="openReceivingModal(this)">
            <i class="fa-solid fa-clipboard-check"></i> Inspect &amp; Receive
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    }
  });

  // Si no hay filas en tránsito, mostrar mensaje vacío
  if (inTransitCount === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="padding: 2.5rem; color: #64748b;">
          <i class="fa-solid fa-box-open" style="font-size: 1.75rem; margin-bottom: 0.5rem; display: block; color: #94a3b8;"></i>
          No shipments currently in transit awaiting inspection.
        </td>
      </tr>
    `;
  }

  // Actualizar contador del header
  const countBadge = document.getElementById("warehouseCountBadge");
  if (countBadge) {
    countBadge.innerHTML = `<i class="fa-solid fa-plane-arrival"></i> ${inTransitCount} Awaiting Inspection`;
  }
}

function openReceivingModal(button) {
  currentInspectionRow = button.closest("tr");
  if (!currentInspectionRow) return;

  const reqId = currentInspectionRow.getAttribute("data-id") || "";
  const pn = currentInspectionRow.getAttribute("data-pn") || "";
  const target = currentInspectionRow.getAttribute("data-target") || "";
  const carrier = currentInspectionRow.getAttribute("data-carrier") || "";
  const awb = currentInspectionRow.getAttribute("data-awb") || "";

  document.getElementById("inspReqId").innerText = reqId;
  document.getElementById("inspExpectedPn").value = pn;
  document.getElementById("inspCarrierAwb").innerText = `${carrier} • ${awb}`;
  document.getElementById("inspDest").innerText = target;

  const scannedInput = document.getElementById("inspScannedPn");
  if (scannedInput) {
    scannedInput.value = "";
    scannedInput.classList.remove("border-danger");
  }

  // Resetear Packaging a Intact por defecto
  const intactRadio = document.querySelector('input[name="packagingRadio"][value="Intact"]');
  if (intactRadio) {
    intactRadio.checked = true;
    togglePackagingStyle();
  }

  const alertBox = document.getElementById("nonConformityAlert");
  if (alertBox) alertBox.classList.add("hidden");

  const pnError = document.getElementById("inspPnError");
  if (pnError) pnError.classList.add("hidden");

  openModal("modalWarehouseInspection");
  if (scannedInput) scannedInput.focus();
}

function simulateBarcodeScan() {
  const expectedPn = document.getElementById("inspExpectedPn").value;
  const scannedInput = document.getElementById("inspScannedPn");
  if (scannedInput) {
    scannedInput.value = expectedPn;
    checkInspectionCondition();
  }
}

function togglePackagingStyle() {
  const selectedRadio = document.querySelector('input[name="packagingRadio"]:checked');
  const val = selectedRadio ? selectedRadio.value : "Intact";

  const lblIntact = document.getElementById("lblPkgIntact");
  const lblDamaged = document.getElementById("lblPkgDamaged");

  if (val === "Damaged") {
    if (lblDamaged) lblDamaged.className = "packaging-toggle-option active damaged";
    if (lblIntact) lblIntact.className = "packaging-toggle-option";
  } else {
    if (lblIntact) lblIntact.className = "packaging-toggle-option active";
    if (lblDamaged) lblDamaged.className = "packaging-toggle-option";
  }

  checkInspectionCondition();
}

function checkInspectionCondition() {
  const expectedPn = (document.getElementById("inspExpectedPn")?.value || "").trim().toUpperCase();
  const scannedPn = (document.getElementById("inspScannedPn")?.value || "").trim().toUpperCase();
  const selectedRadio = document.querySelector('input[name="packagingRadio"]:checked');
  const packaging = selectedRadio ? selectedRadio.value : "Intact";

  const alertBox = document.getElementById("nonConformityAlert");
  const alertMsg = document.getElementById("nonConformityMsg");

  if (!alertBox || !alertMsg) return;

  const isDamaged = (packaging === "Damaged");
  const isMismatch = (scannedPn && scannedPn !== expectedPn);

  if (isDamaged || isMismatch) {
    alertBox.classList.remove("hidden");
    if (isDamaged && isMismatch) {
      alertMsg.innerText = "CRITICAL NON-CONFORMITY: Part Number mismatch AND damaged packaging detected. Shipment must be quarantined with an immediate Red Tag.";
    } else if (isDamaged) {
      alertMsg.innerText = "COMPROMISED PACKAGING: Transit damage detected. Potential internal shock or contamination risk. Component will be quarantined.";
    } else {
      alertMsg.innerText = `P/N MISMATCH: Expected ${expectedPn} but scanned ${scannedPn}. Suspected unapproved or incorrect component. Immediate quarantine required.`;
    }
  } else {
    alertBox.classList.add("hidden");
  }
}

// Escuchar cambios en el input de escaneo
document.addEventListener("DOMContentLoaded", () => {
  const scannedInput = document.getElementById("inspScannedPn");
  if (scannedInput) {
    scannedInput.addEventListener("input", checkInspectionCondition);
  }
  refreshWarehouseReceivingTable();
});

function submitWarehouseInspection() {
  if (!currentInspectionRow) return;

  const expectedPn = (document.getElementById("inspExpectedPn")?.value || "").trim().toUpperCase();
  const scannedInput = document.getElementById("inspScannedPn");
  const scannedPn = (scannedInput?.value || "").trim().toUpperCase();
  const pnError = document.getElementById("inspPnError");

  if (!scannedPn) {
    if (pnError) pnError.classList.remove("hidden");
    if (scannedInput) scannedInput.focus();
    return;
  }
  if (pnError) pnError.classList.add("hidden");

  const selectedRadio = document.querySelector('input[name="packagingRadio"]:checked');
  const packaging = selectedRadio ? selectedRadio.value : "Intact";

  const reqId = currentInspectionRow.getAttribute("data-id") || "";
  const isIntact = (packaging === "Intact");
  const isMatch = (scannedPn === expectedPn);

  closeModal("modalWarehouseInspection");

  // Encontrar la fila correspondiente en la tabla de My Requisitions
  const reqRow = document.querySelector(`#requisitionsTableBody tr[data-id="${reqId}"]`);

  // =========================================================================
  // CONDICIÓN 1: Intact + Part Numbers Match -> Estado: "Received" (Green)
  // =========================================================================
  if (isIntact && isMatch) {
    // 1. Actualizar fila en Warehouse Receiving
    const cells = currentInspectionRow.querySelectorAll("td");
    if (cells.length >= 8) {
      cells[7].innerHTML = `<span class="badge-status received"><i class="fa-solid fa-circle-check"></i> Received</span>`;
    }
    if (cells.length >= 9) {
      cells[8].innerHTML = `<span class="badge-status instock"><i class="fa-solid fa-warehouse"></i> Stocked (Bay 1)</span>`;
    }

    // 2. Actualizar fila correspondiente en My Requisitions a "In Stock"
    if (reqRow) {
      reqRow.setAttribute("data-status", "In Stock");
      reqRow.setAttribute("data-location", "Bay 1 - Shelf A");
      const reqCells = reqRow.querySelectorAll("td");
      if (reqCells.length >= 8) {
        reqCells[7].innerHTML = `<span class="badge-status instock">In Stock</span>`;
      }
    }

    alert(`✓ Component Successfully Received & Accepted!\n\nRequisition: ${reqId}\nPart Number: ${expectedPn}\nInspection Result: Form 1 Verified, Packaging Intact.\nLocation: Hangar Warehouse Bay 1.`);
  }
  // =========================================================================
  // CONDICIÓN 2: Damaged o P/N Mismatch -> Estado: "Quarantined" (Red / Red Tag)
  // =========================================================================
  else {
    // 1. Actualizar fila en Warehouse Receiving
    const cells = currentInspectionRow.querySelectorAll("td");
    if (cells.length >= 8) {
      cells[7].innerHTML = `<span class="badge-status quarantined"><i class="fa-solid fa-triangle-exclamation"></i> Quarantined</span>`;
    }
    if (cells.length >= 9) {
      cells[8].innerHTML = `<span class="badge-status quarantined"><i class="fa-solid fa-ban"></i> Red Tagged</span>`;
    }

    // 2. Actualizar fila correspondiente en My Requisitions
    if (reqRow) {
      reqRow.setAttribute("data-status", "Quarantined");
      const reqCells = reqRow.querySelectorAll("td");
      if (reqCells.length >= 8) {
        reqCells[7].innerHTML = `<span class="badge-status quarantined">Quarantined</span>`;
      }
    }

    const reason = !isIntact && !isMatch
      ? "Packaging damaged AND Part Number mismatch"
      : (!isIntact ? "Compromised / damaged packaging" : "Part Number discrepancy");

    alert(`⚠ NON-CONFORMITY ALERT - COMPONENT QUARANTINED!\n\nRequisition: ${reqId}\nNon-Conformance: ${reason}\nAction: Placed under physical lock in Quarantine Bay with Red Tag.\nTCCA / FAA Non-Conformance Report logged.`);
  }

  // Refrescar el contador de pendientes
  const activeInTransit = document.querySelectorAll("#warehouseTableBody tr td .badge-status.transit").length;
  const countBadge = document.getElementById("warehouseCountBadge");
  if (countBadge) {
    countBadge.innerHTML = `<i class="fa-solid fa-plane-arrival"></i> ${activeInTransit} Awaiting Inspection`;
  }
}
