// Helper: Get value from input by ID
// Returns the trimmed string value of the specified input field
function getInputValue(id) {
    return document.getElementById(id).value.trim();
}

// Helper: Format date for UI display
// Converts a date string to a readable locale string, or returns "-" if empty/invalid
function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr).toLocaleString();
    return d;
}

// Helper: Get correct UOM from orderApiObj, fallback to known fields
function getOrderUOM(orderApiObj) {
    if (orderApiObj.productionUnitOfMeasureObject && orderApiObj.productionUnitOfMeasureObject.uom) {
        return orderApiObj.productionUnitOfMeasureObject.uom;
    }
    if (orderApiObj.erpUnitOfMeasure) {
        return orderApiObj.erpUnitOfMeasure;
    }
    if (orderApiObj.baseUnitOfMeasureObject && orderApiObj.baseUnitOfMeasureObject.uom) {
        return orderApiObj.baseUnitOfMeasureObject.uom;
    }
    return "";
}

// Mapper: Transforms a single API order object into the UI row object
// Ensures required fields are shown (or "-" if missing) and formats fields for display
function mapOrderApiToUiRow(orderApiObj) {
    const uom = getOrderUOM(orderApiObj);
    
    return {
        orderNo: orderApiObj.order || "-",
        parentSFC: "-",
        materialAndDesc: orderApiObj.material
            ? `${orderApiObj.material.material} / ${orderApiObj.material.version}<br><span class=\"mat-desc\">${orderApiObj.material.description}</span>`
            : "-",
        executionStatus: orderApiObj.executionStatus || "-",
        buildQty: orderApiObj.buildQuantity !== undefined
            ? `${orderApiObj.buildQuantity} ${uom}` : "-",
        doneQty: orderApiObj.doneQuantity !== undefined
            ? `${orderApiObj.doneQuantity} ${uom}` : "-",
        scheduledStartEnd: `${formatDate(orderApiObj.scheduledStartDate)}<br>${formatDate(orderApiObj.scheduledCompletionDate)}`,
        priority: orderApiObj.priority || "-"
    };
}

// Render: Updates the HTML table with order data
// Also updates the Items count in the heading
function updateOrdersTable(dataArray) {
    const tbody = document.querySelector("#ordersTableBody");
    const heading = document.getElementById("itemsHeading"); // Update heading with count
    
    // Compute and display number of results, always as two digits
    let count = dataArray && dataArray.length ? dataArray.length : 0;
    heading.textContent = `Items (${count.toString().padStart(2, "0")})`;

    // Clear any old table content
    tbody.innerHTML = "";
    
    // If no data, show "No orders found" row
    if (!dataArray || dataArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan=\"9\">No orders found.</td></tr>`;
        return;
    }

    // Loop through data array and add a table row for each order
    dataArray.forEach(orderObj => {
        const rowHtml = `
            <tr>
                <td><input type=\"radio\" name=\"orderSelect\"></td>
                <td>${orderObj.orderNo}</td>
                <td>${orderObj.parentSFC}</td>
                <td>${orderObj.materialAndDesc}</td>
                <td>${orderObj.executionStatus}</td>
                <td>${orderObj.buildQty}</td>
                <td>${orderObj.doneQty}</td>
                <td>${orderObj.scheduledStartEnd}</td>
                <td>${orderObj.priority}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", rowHtml);
    });
}

// Utility: Display an error message (currently via alert, can replace with custom modal)
function showError(msg) {
    alert(msg);
}

// Main entry point: Called on Filter button press
// Collects filters, validates them, builds query, fetches from backend, applies client-side fallback filtering, and updates UI
async function onFilterPress() {
    const plant = "5728"; // Hardcoded plant code
    const material = getInputValue("material");
    const executionStatus = document.getElementById("executionStatus").value;
    const orderNumber = getInputValue("orderNo");
    const dateFrom = getInputValue("dateFrom");
    const dateTo = getInputValue("dateTo");

    // Validate that material is present
    if (!material) {
        showError("Material is mandatory.");
        return;
    }

    // Validate date range (if both provided)
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        showError("Date From cannot be later than Date To.");
        return;
    }

    // Build request params object for backend API
    const params = { plant, material };
    if (executionStatus) params.executionStatus = executionStatus;
    if (orderNumber) params.orderNumber = orderNumber;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    // Construct the backend API URL with all relevant query params
    const queryString = new URLSearchParams(params).toString();
    const apiUrl = `http://localhost:3000/api/orders?${queryString}`;

    try {
        // Fetch order list from backend (proxy to SAP DMC API)
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("No orders found.");

        let apiData = await response.json();
        let ordersList = apiData.content || [];
        let updatedArr = [];

        // Client-side filtering by date (as fallback if backend ignores/partial dates)
        if(dateFrom && dateTo) {
            updatedArr = ordersList.filter(item =>
                item.scheduledStartDate && item.scheduledCompletionDate &&
                new Date(item.scheduledStartDate) >= new Date(dateFrom) &&
                new Date(item.scheduledCompletionDate) <= new Date(dateTo)
            );
        } else {
            updatedArr = ordersList;
        }

        // Client-side filtering by execution status (as fallback)
        if (executionStatus) {
            updatedArr = updatedArr.filter(item =>
                item.executionStatus && item.executionStatus === executionStatus
            );
        }

        // For debugging: log what was received from backend
        //console.log("API Response:", ordersList);

        // Map backend objects to UI rows and update table
        const uiRows = updatedArr.map(mapOrderApiToUiRow);
        updateOrdersTable(uiRows);

    } catch (e) {
        // Handle error: show message and clear table
        showError(e.message);
        updateOrdersTable([]);
    }
}

