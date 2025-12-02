$(document).ready(function () {

    // =========================================================
    // CONFIGURATION
    // =========================================================
    const apiURL = "https://script.google.com/macros/s/AKfycbwV8yt3eD8PsaIq5YWUpvNOFjaJNoUH9cTUn7mgUM4oRmTf_zxHhBoq--CeNeKBTT5X/exec";

    let currentDate = "";
    let tableData = [];
    let originalData = [];
    let changedRows = {};
    let newRows = [];  // Track newly added rows
    let membersList = [];  // Store team members


    // =========================================================
    // INITIALIZATION
    // =========================================================
    function init() {
        currentDate = getTodayYMD();
        $("#dateSelector").val(currentDate);
        fetchData();
        fetchMembers();  // Load team members list
    }

    init();


    // =========================================================
    // DATE HELPERS
    // =========================================================

    function getTodayYMD() {
        const t = new Date();
        const yyyy = t.getFullYear();
        const mm = String(t.getMonth() + 1).padStart(2, "0");
        const dd = String(t.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    function normalizeDate(raw) {
        if (!raw) return "";
        const d = new Date(raw);
        if (isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }


    // =========================================================
    // TIME HELPERS
    // =========================================================

    function to12hr(time24) {
        if (!time24) return "";
        let [h, m] = time24.split(":");
        h = parseInt(h, 10);
        if (isNaN(h)) return "";
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
    }

    function to24hr(time12) {
        if (!time12) return "";
        if (!time12.includes(" ")) {
            return time12.padStart(5, "0");
        }
        const parts = time12.trim().split(" ");
        if (parts.length !== 2) return "";
        let [time, suffix] = parts;
        let [h, m] = time.split(":");
        h = parseInt(h, 10);
        if (isNaN(h)) return "";
        suffix = suffix.toUpperCase();
        if (suffix === "PM" && h !== 12) h += 12;
        if (suffix === "AM" && h === 12) h = 0;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    function normalizeTimeInput(val) {
        if (!val) return "";

        if (val instanceof Date) {
            const hh = String(val.getHours()).padStart(2, "0");
            const mm = String(val.getMinutes()).padStart(2, "0");
            return `${hh}:${mm}`;
        }

        if (typeof val === "string" && val.includes("T")) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const hh = String(d.getHours()).padStart(2, "0");
                const mm = String(d.getMinutes()).padStart(2, "0");
                return `${hh}:${mm}`;
            }
        }

        if (typeof val === "number" && !isNaN(val)) {
            const totalMinutes = Math.round(val * 24 * 60);
            const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
            const mm = String(totalMinutes % 60).padStart(2, "0");
            return `${hh}:${mm}`;
        }

        if (typeof val === "string") {
            val = val.trim();
            if (val.toUpperCase().includes("AM") || val.toUpperCase().includes("PM")) {
                return to24hr(val);
            }
            if (/^\d{1,2}:\d{2}$/.test(val)) {
                let [h, m] = val.split(":");
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            }
        }

        return "";
    }


    // =========================================================
    // API - FETCH ATTENDANCE DATA
    // =========================================================
    function fetchData() {
        showLoader();
        hideError();
        disableControls();

        $.getJSON(apiURL + "?action=getAttendance&date=" + encodeURIComponent(currentDate))
            .done(function (res) {
                if (res.error) {
                    showError(res.error);
                    tableData = [];
                } else {
                    tableData = Array.isArray(res) ? res : [];
                    originalData = JSON.parse(JSON.stringify(tableData));
                }
                newRows = [];
                renderTable();
                updateSummary();
            })
            .fail(function (xhr, status, error) {
                showError("Failed to fetch data: " + (error || status));
                tableData = [];
                renderTable();
                updateSummary();
            })
            .always(function () {
                hideLoader();
                enableControls();
            });
    }


    // =========================================================
    // API - FETCH TEAM MEMBERS LIST
    // =========================================================
    function fetchMembers() {
        $.getJSON(apiURL + "?action=getMembers")
            .done(function (res) {
                if (Array.isArray(res)) {
                    membersList = res;
                } else {
                    membersList = [];
                }
            })
            .fail(function () {
                membersList = [];
            });
    }


    // =========================================================
    // API - SAVE DATA
    // =========================================================
    function saveData() {
        const batch = [];

        // Collect changed existing rows
        Object.keys(changedRows).forEach(function (idx) {
            const tr = $(`tr[data-index="${idx}"]`);
            const r = tableData[idx];

            if (!r) return;

            const pin24 = tr.find(".inp-in").val();
            const pout24 = tr.find(".inp-out").val();

            batch.push({
                date: currentDate,
                name: r.name,
                punchIn: to12hr(pin24),
                punchOut: to12hr(pout24),
                status: tr.find(".inp-status").val(),
                comments: tr.find(".inp-comment").val()
            });
        });

        // Collect new rows
        $("tr.row-new").each(function () {
            const tr = $(this);
            const name = tr.find(".inp-name").val() || tr.find("td:first").text().trim();

            if (!name) return;

            const pin24 = tr.find(".inp-in").val();
            const pout24 = tr.find(".inp-out").val();

            batch.push({
                date: currentDate,
                name: name,
                punchIn: to12hr(pin24),
                punchOut: to12hr(pout24),
                status: tr.find(".inp-status").val(),
                comments: tr.find(".inp-comment").val(),
                isNew: true
            });
        });

        if (batch.length === 0) {
            showError("No changes to save");
            return;
        }

        setSaving(true);

        $.ajax({
            url: apiURL,
            method: "POST",
            contentType: "text/plain;charset=utf-8",
            data: JSON.stringify({ batch: batch }),
            timeout: 30000
        })
            .done(function (res) {
                let response = res;
                if (typeof res === "string") {
                    try {
                        response = JSON.parse(res);
                    } catch (e) {
                        response = { error: "Invalid response" };
                    }
                }

                if (response.error) {
                    showError("Save failed: " + response.error);
                    setSaving(false);
                } else {
                    showSaveSuccess();
                    showSuccess(`Saved successfully! (${response.updated || 0} updated, ${response.inserted || 0} inserted)`);
                    setTimeout(function () {
                        resetSaveButton();
                        fetchData();
                    }, 1500);
                }
            })
            .fail(function (xhr, status, error) {
                showError("Save failed: " + (error || status));
                setSaving(false);
            });
    }


    // =========================================================
    // RENDER TABLE
    // =========================================================
    function renderTable() {
        const tbody = $("#attendanceTable");
        tbody.empty();
        changedRows = {};
        hideSaveButtons();
        hideUnsavedIndicator();

        const totalCount = tableData.length + newRows.length;
        $("#recordCount").text(`${totalCount} record(s)`);

        // Empty state (only if no existing data AND no new rows)
        if (tableData.length === 0 && newRows.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="6" class="p-8 text-center text-gray-500">
                        <div class="flex flex-col items-center gap-2">
                            <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                            <p class="text-lg">No attendance records for this date</p>
                            <p class="text-sm">Click "Add Entry" or "Add All Members" to create records</p>
                        </div>
                    </td>
                </tr>
            `);
            return;
        }

        // Render existing rows
        tableData.forEach(function (r, idx) {
            const status = (r.status || "").toLowerCase();
            const punchInVal = normalizeTimeInput(r.punchIn);
            const punchOutVal = normalizeTimeInput(r.punchOut);
            const commentsVal = escapeHtml(r.comments || "");

            tbody.append(`
                <tr data-index="${idx}" data-type="existing" class="hover:bg-gray-50 transition-colors">
                    <td class="p-3 border font-medium">${escapeHtml(r.name || "")}</td>
                    <td class="p-3 border">
                        <input type="time" class="inp-in w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" value="${punchInVal}">
                    </td>
                    <td class="p-3 border">
                        <input type="time" class="inp-out w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" value="${punchOutVal}">
                    </td>
                    <td class="p-3 border">
                        <select class="inp-status w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none">
                            <option value="Ontime" ${status === "ontime" ? "selected" : ""}>Ontime</option>
                            <option value="Late" ${status === "late" ? "selected" : ""}>Late</option>
                            <option value="Absent" ${status === "absent" ? "selected" : ""}>Absent</option>
                            <option value="Leave" ${status === "leave" ? "selected" : ""}>Leave</option>
                        </select>
                    </td>
                    <td class="p-3 border">
                        <input type="text" class="inp-comment w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" value="${commentsVal}" placeholder="Add comment...">
                    </td>
                    <td class="p-3 border text-center">
                        <button class="btn-delete text-red-500 hover:text-red-700 p-1" title="Delete">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `);
        });

        // Render new rows
        newRows.forEach(function (r, idx) {
            const newIdx = "new-" + idx;
            const status = (r.status || "").toLowerCase();

            tbody.append(`
                <tr data-index="${newIdx}" data-type="new" class="row-new hover:bg-green-50 transition-colors">
                    <td class="p-3 border font-medium">${escapeHtml(r.name || "")}</td>
                    <td class="p-3 border">
                        <input type="time" class="inp-in w-full p-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none" value="${r.punchIn || ""}">
                    </td>
                    <td class="p-3 border">
                        <input type="time" class="inp-out w-full p-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none" value="${r.punchOut || ""}">
                    </td>
                    <td class="p-3 border">
                        <select class="inp-status w-full p-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none">
                            <option value="Ontime" ${status === "ontime" ? "selected" : ""}>Ontime</option>
                            <option value="Late" ${status === "late" ? "selected" : ""}>Late</option>
                            <option value="Absent" ${status === "absent" ? "selected" : ""}>Absent</option>
                            <option value="Leave" ${status === "leave" ? "selected" : ""}>Leave</option>
                        </select>
                    </td>
                    <td class="p-3 border">
                        <input type="text" class="inp-comment w-full p-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none" value="${escapeHtml(r.comments || "")}" placeholder="Add comment...">
                    </td>
                    <td class="p-3 border text-center">
                        <button class="btn-remove-new text-red-500 hover:text-red-700 p-1" data-newidx="${idx}" title="Remove">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `);
        });

        // Show save button if new rows exist
        if (newRows.length > 0) {
            showSaveButtons();
            showUnsavedIndicator();
        }

        // Attach change listeners
        $("#attendanceTable").find("tr[data-type='existing']").find("input, select").on("change input", function () {
            const idx = $(this).closest("tr").data("index");
            markRowChanged(idx);
        });

        // Attach remove new row handler
        $(".btn-remove-new").on("click", function () {
            const newIdx = $(this).data("newidx");
            newRows.splice(newIdx, 1);
            renderTable();
            updateSummary();
        });

        // Attach delete handler (for existing rows - marks for deletion)
        $(".btn-delete").on("click", function () {
            const tr = $(this).closest("tr");
            const idx = tr.data("index");
            
            if (confirm("Remove this entry? (Will be deleted when you save)")) {
                // Mark for deletion by setting status to DELETE
                tr.find(".inp-status").val("DELETE");
                tr.addClass("bg-red-100 line-through opacity-50");
                markRowChanged(idx);
            }
        });
    }


    // =========================================================
    // ADD NEW ENTRY (from modal)
    // =========================================================
    function addNewEntry(name, punchIn, punchOut, status, comments) {
        // Check for duplicates
        const exists = tableData.some(r => r.name.toLowerCase() === name.toLowerCase()) ||
            newRows.some(r => r.name.toLowerCase() === name.toLowerCase());

        if (exists) {
            showError(`Entry for "${name}" already exists`);
            return false;
        }

        newRows.push({
            name: name,
            punchIn: punchIn || "",
            punchOut: punchOut || "",
            status: status || "Absent",
            comments: comments || ""
        });

        renderTable();
        updateSummary();
        return true;
    }


    // =========================================================
    // UPDATE SUMMARY CARDS
    // =========================================================
    function updateSummary() {
        let late = 0, absent = 0, leave = 0, ontime = 0;

        // Count from existing data
        tableData.forEach(function (r) {
            const status = (r.status || "").toLowerCase();
            switch (status) {
                case "late": late++; break;
                case "absent": absent++; break;
                case "leave": leave++; break;
                case "ontime": ontime++; break;
            }
        });

        // Count from new rows
        newRows.forEach(function (r) {
            const status = (r.status || "").toLowerCase();
            switch (status) {
                case "late": late++; break;
                case "absent": absent++; break;
                case "leave": leave++; break;
                case "ontime": ontime++; break;
            }
        });

        const total = tableData.length + newRows.length;

        $("#totalMembers").text(total);
        $("#totalPunchins").text(ontime + late);
        $("#totalLate").text(late);
        $("#totalAbsent").text(absent);
        $("#totalLeave").text(leave);
    }


    // =========================================================
    // UI HELPERS
    // =========================================================

    function markRowChanged(idx) {
        changedRows[idx] = true;
        $(`tr[data-index="${idx}"]`).addClass("row-changed");
        showSaveButtons();
        showUnsavedIndicator();
    }

    function showLoader() {
        $("#loader").removeClass("hidden").addClass("flex");
    }

    function hideLoader() {
        $("#loader").addClass("hidden").removeClass("flex");
    }

    function showError(message) {
        $("#errorText").text(message);
        $("#errorMessage").removeClass("hidden");
        // Auto hide after 5 seconds
        setTimeout(hideError, 5000);
    }

    function hideError() {
        $("#errorMessage").addClass("hidden");
    }

    function showSuccess(message) {
        $("#successText").text(message);
        $("#successMessage").removeClass("hidden");
        // Auto hide after 3 seconds
        setTimeout(hideSuccess, 3000);
    }

    function hideSuccess() {
        $("#successMessage").addClass("hidden");
    }

    function showSaveButtons() {
        $("#saveAllBtn").removeClass("hidden").addClass("flex");
        $("#cancelBtn").removeClass("hidden");
    }

    function hideSaveButtons() {
        $("#saveAllBtn").addClass("hidden").removeClass("flex");
        $("#cancelBtn").addClass("hidden");
    }

    function showUnsavedIndicator() {
        $("#unsavedIndicator").removeClass("hidden").addClass("flex");
    }

    function hideUnsavedIndicator() {
        $("#unsavedIndicator").addClass("hidden").removeClass("flex");
    }

    function disableControls() {
        $("#dateSelector").prop("disabled", true);
        $("#refreshBtn").prop("disabled", true);
        $("#addEntryBtn").prop("disabled", true);
        $("#bulkAddBtn").prop("disabled", true);
        $("#tableSection").addClass("disabled-overlay");
    }

    function enableControls() {
        $("#dateSelector").prop("disabled", false);
        $("#refreshBtn").prop("disabled", false);
        $("#addEntryBtn").prop("disabled", false);
        $("#bulkAddBtn").prop("disabled", false);
        $("#tableSection").removeClass("disabled-overlay");
    }

    function setSaving(isSaving) {
        if (isSaving) {
            $("#saveAllBtn").prop("disabled", true);
            $("#saveText").text("Saving...");
            $("#cancelBtn").prop("disabled", true);
            disableControls();
        } else {
            $("#saveAllBtn").prop("disabled", false);
            $("#saveText").text("Save Changes");
            $("#cancelBtn").prop("disabled", false);
            enableControls();
        }
    }

    function showSaveSuccess() {
        $("#saveText").text("Saved ✓");
        $("#saveAllBtn")
            .removeClass("bg-green-600 hover:bg-green-700")
            .addClass("bg-green-800");
    }

    function resetSaveButton() {
        $("#saveText").text("Save Changes");
        $("#saveAllBtn")
            .removeClass("bg-green-800")
            .addClass("bg-green-600 hover:bg-green-700")
            .prop("disabled", false);
        hideSaveButtons();
        hideUnsavedIndicator();
    }

    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function hasUnsavedChanges() {
        return Object.keys(changedRows).length > 0 || newRows.length > 0;
    }


    // =========================================================
    // MODAL HELPERS
    // =========================================================

    function openModal() {
        $("#addModal").removeClass("hidden");
        $("#modalName").val("").focus();
        $("#modalPunchIn").val("");
        $("#modalPunchOut").val("");
        $("#modalStatus").val("Ontime");
        $("#modalComments").val("");
    }

    function closeModal() {
        $("#addModal").addClass("hidden");
    }

    function openBulkModal() {
        $("#bulkModal").removeClass("hidden");
        renderMembersList();
    }

    function closeBulkModal() {
        $("#bulkModal").addClass("hidden");
    }

    function renderMembersList() {
        const container = $("#membersList");
        container.empty();

        if (membersList.length === 0) {
            container.html(`
                <div class="text-center py-4">
                    <p class="text-gray-500 mb-2">No members found in Members sheet</p>
                    <p class="text-sm text-gray-400">Create a "Members" sheet with a "name" column</p>
                </div>
            `);
            return;
        }

        // Filter out members already in today's attendance
        const existingNames = [
            ...tableData.map(r => r.name.toLowerCase()),
            ...newRows.map(r => r.name.toLowerCase())
        ];

        const availableMembers = membersList.filter(m =>
            !existingNames.includes(m.name.toLowerCase())
        );

        if (availableMembers.length === 0) {
            container.html(`
                <div class="text-center py-4">
                    <p class="text-gray-500">All members already have entries for this date</p>
                </div>
            `);
            return;
        }

        // Select all checkbox
        container.append(`
            <label class="flex items-center p-2 hover:bg-gray-100 rounded border-b">
                <input type="checkbox" id="selectAllMembers" class="mr-3 w-4 h-4">
                <span class="font-medium">Select All (${availableMembers.length})</span>
            </label>
        `);

        availableMembers.forEach(function (m, idx) {
            container.append(`
                <label class="flex items-center p-2 hover:bg-gray-100 rounded">
                    <input type="checkbox" class="member-checkbox mr-3 w-4 h-4" value="${escapeHtml(m.name)}">
                    <span>${escapeHtml(m.name)}</span>
                </label>
            `);
        });

        // Select all handler
        $("#selectAllMembers").on("change", function () {
            $(".member-checkbox").prop("checked", $(this).is(":checked"));
        });
    }


    // =========================================================
    // EVENT HANDLERS
    // =========================================================

    // Date change
    $("#dateSelector").on("change", function () {
        if (hasUnsavedChanges()) {
            if (!confirm("You have unsaved changes. Discard and continue?")) {
                $(this).val(currentDate);
                return;
            }
        }
        currentDate = normalizeDate($(this).val());
        fetchData();
    });

    // Refresh button
    $("#refreshBtn").on("click", function () {
        if (hasUnsavedChanges()) {
            if (!confirm("You have unsaved changes. Discard and refresh?")) {
                return;
            }
        }
        fetchData();
    });

    // Save button
    $("#saveAllBtn").on("click", function () {
        saveData();
    });

    // Cancel button
    $("#cancelBtn").on("click", function () {
        if (confirm("Discard all changes?")) {
            tableData = JSON.parse(JSON.stringify(originalData));
            newRows = [];
            renderTable();
            updateSummary();
        }
    });

    // Add Entry button - open modal
    $("#addEntryBtn").on("click", function () {
        openModal();
    });

    // Modal close buttons
    $("#closeModal, #cancelModal").on("click", function () {
        closeModal();
    });

    // Modal form submit
    $("#addEntryForm").on("submit", function (e) {
        e.preventDefault();

        const name = $("#modalName").val().trim();
        const punchIn = $("#modalPunchIn").val();
        const punchOut = $("#modalPunchOut").val();
        const status = $("#modalStatus").val();
        const comments = $("#modalComments").val().trim();

        if (!name) {
            showError("Name is required");
            return;
        }

        if (addNewEntry(name, punchIn, punchOut, status, comments)) {
            closeModal();
            showSuccess(`Added entry for "${name}"`);
        }
    });

    // Bulk Add button - open modal
    $("#bulkAddBtn").on("click", function () {
        openBulkModal();
    });

    // Bulk modal close buttons
    $("#closeBulkModal, #cancelBulkModal").on("click", function () {
        closeBulkModal();
    });

    // Bulk add confirm
    $("#confirmBulkAdd").on("click", function () {
        const selectedMembers = [];
        $(".member-checkbox:checked").each(function () {
            selectedMembers.push($(this).val());
        });

        if (selectedMembers.length === 0) {
            showError("Please select at least one member");
            return;
        }

        const defaultStatus = $("#bulkStatus").val();
        const defaultPunchIn = $("#bulkPunchIn").val();

        let addedCount = 0;
        selectedMembers.forEach(function (name) {
            if (addNewEntry(name, defaultPunchIn, "", defaultStatus, "")) {
                addedCount++;
            }
        });

        closeBulkModal();
        showSuccess(`Added ${addedCount} entries`);
    });

    // Close error/success messages
    $("#closeError").on("click", hideError);
    $("#closeSuccess").on("click", hideSuccess);

    // Close modal on backdrop click
    $("#addModal, #bulkModal").on("click", function (e) {
        if (e.target === this) {
            $(this).addClass("hidden");
        }
    });

    // Warn before leaving
    $(window).on("beforeunload", function (e) {
        if (hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = "";
            return "You have unsaved changes. Are you sure you want to leave?";
        }
    });

    // ESC key closes modals
    $(document).on("keydown", function (e) {
        if (e.key === "Escape") {
            closeModal();
            closeBulkModal();
        }
    });

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

});