// Helper: Get value from input by ID
function getInputValue(id) {
    return document.getElementById(id).value.trim();
}

// Helper: Format date for UI display
function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr).toLocaleString();
    return d;
}

// Map API response object to UI fields
function mapOrderApiToUiRow(orderApiObj) {
    return {
        orderNo: orderApiObj.order || "-",
        parentSFC: "-",
        materialAndDesc: orderApiObj.material
            ? `${orderApiObj.material.material} / ${orderApiObj.material.version}<br><span class=\"mat-desc\">${orderApiObj.material.description}</span>`
            : "-",
        executionStatus: orderApiObj.executionStatus || "-",
        buildQty: orderApiObj.buildQuantity !== undefined && orderApiObj.productionUnitOfMeasure
            ? `${orderApiObj.buildQuantity} ${orderApiObj.productionUnitOfMeasure}`
            : "-",
        productionQty: orderApiObj.productionQuantity !== undefined && orderApiObj.productionUnitOfMeasure
            ? `${orderApiObj.productionQuantity} ${orderApiObj.productionUnitOfMeasure}`
            : "-",
        scheduledStartEnd: `${formatDate(orderApiObj.scheduledStartDate)}<br>${formatDate(orderApiObj.scheduledCompletionDate)}`,
        priority: orderApiObj.priority || "-"
    };
}

// Render orders in the table
function updateOrdersTable(dataArray) {
    const tbody = document.querySelector("#ordersTableBody");
    const heading = document.getElementById("itemsHeading"); // Update heading with count
    
    // Calculate and update Items count
    let count = dataArray && dataArray.length ? dataArray.length : 0;
    heading.textContent = `Items (${count.toString().padStart(2, "0")})`;

    tbody.innerHTML = "";

    if (!dataArray || dataArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan=\"9\">No orders found.</td></tr>`;
        return;
    }

    dataArray.forEach(orderObj => {
        const rowHtml = `
            <tr>
                <td><input type=\"radio\" name=\"orderSelect\"></td>
                <td>${orderObj.orderNo}</td>
                <td>${orderObj.parentSFC}</td>
                <td>${orderObj.materialAndDesc}</td>
                <td>${orderObj.executionStatus}</td>
                <td>${orderObj.buildQty}</td>
                <td>${orderObj.productionQty}</td>
                <td>${orderObj.scheduledStartEnd}</td>
                <td>${orderObj.priority}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", rowHtml);
    });
}

// Display Error
function showError(msg) {
    alert(msg);
}

// MAIN FUNCTION
async function onFilterPress() {
    const plant = "5728";
    const material = getInputValue("material");
    const orderNumber = getInputValue("orderNo");
    const dateFrom = getInputValue("dateFrom");
    const dateTo = getInputValue("dateTo");

    if (!material) {
        showError("Material is mandatory.");
        return;
    }

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        showError("Date From cannot be later than Date To.");
        return;
    }

    const params = { plant, material };
    if (orderNumber) params.orderNumber = orderNumber;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const queryString = new URLSearchParams(params).toString();
    const apiUrl = `http://localhost:3000/api/orders?${queryString}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("No orders found.");

        let apiData = await response.json();
        const ordersList = apiData.content || [];
        let updatedArr = [];
        if(dateFrom && dateTo) {
           ordersList.map((item)=>{
            if(item.scheduledStartDate && item.scheduledCompletionDate) {
                if(new Date(item.scheduledStartDate) >= new Date(dateFrom) && new Date(item.scheduledCompletionDate) <= new Date(dateTo)) {
                    updatedArr.push(item);
                }
            }
           })
        }
        else {
            updatedArr = ordersList;
        }
        console.log("API Response:", ordersList);
        
        const uiRows = updatedArr.map(mapOrderApiToUiRow);
        updateOrdersTable(uiRows);

    } catch (e) {
        showError(e.message);
        updateOrdersTable([]);
    }
}
