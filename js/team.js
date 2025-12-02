$(document).ready(function () {

    // =========================================================
    // CONFIGURATION
    // =========================================================
    const apiURL = "https://script.google.com/macros/s/AKfycbwV8yt3eD8PsaIq5YWUpvNOFjaJNoUH9cTUn7mgUM4oRmTf_zxHhBoq--CeNeKBTT5X/exec";

    let membersData = [];
    let filteredData = [];
    let currentMember = null;
    let roleChart = null;
    let statusChart = null;


    // =========================================================
    // INITIALIZATION
    // =========================================================
    function init() {
        fetchMembers();
        setDefaultJoinDate();
        attachEventListeners();
    }

    init();


    // =========================================================
    // API - FETCH ALL MEMBERS
    // =========================================================
    function fetchMembers() {
        showLoader();
        hideError();

        $.getJSON(apiURL + "?action=getAllMembers")
            .done(function (res) {
                if (res.error) {
                    showError(res.error);
                    membersData = [];
                } else {
                    membersData = Array.isArray(res) ? res : [];
                }
                filteredData = [...membersData];
                renderTeamGrid();
                updateStatistics();
                updateLastSyncTime();
            })
            .fail(function (xhr, status, error) {
                showError("Failed to fetch members: " + (error || status));
                membersData = [];
                renderTeamGrid();
            })
            .always(function () {
                hideLoader();
            });
    }


    // =========================================================
    // API - ADD MEMBER
    // =========================================================
    function addMember(memberData) {
        showModalLoading(true);

        $.ajax({
            url: apiURL,
            method: "POST",
            contentType: "text/plain;charset=utf-8",
            data: JSON.stringify({
                action: "addMember",
                member: memberData
            }),
            timeout: 30000
        })
            .done(function (res) {
                let response = parseResponse(res);

                if (response.error) {
                    showError(response.error);
                } else {
                    showSuccess("Member added successfully!");
                    closeModal();
                    fetchMembers();
                }
            })
            .fail(function (xhr, status, error) {
                showError("Failed to add member: " + (error || status));
            })
            .always(function () {
                showModalLoading(false);
            });
    }


    // =========================================================
    // API - UPDATE MEMBER
    // =========================================================
    function updateMember(memberId, memberData) {
        showModalLoading(true);

        $.ajax({
            url: apiURL,
            method: "POST",
            contentType: "text/plain;charset=utf-8",
            data: JSON.stringify({
                action: "updateMember",
                memberId: memberId,
                member: memberData
            }),
            timeout: 30000
        })
            .done(function (res) {
                let response = parseResponse(res);

                if (response.error) {
                    showError(response.error);
                } else {
                    showSuccess("Member updated successfully!");
                    closeModal();
                    fetchMembers();
                }
            })
            .fail(function (xhr, status, error) {
                showError("Failed to update member: " + (error || status));
            })
            .always(function () {
                showModalLoading(false);
            });
    }


    // =========================================================
    // API - DELETE/DEACTIVATE MEMBER
    // =========================================================
    function deleteMember(memberId, deactivateOnly = false) {
        $("#confirmDeleteBtn").prop("disabled", true).text("Processing...");

        $.ajax({
            url: apiURL,
            method: "POST",
            contentType: "text/plain;charset=utf-8",
            data: JSON.stringify({
                action: deactivateOnly ? "deactivateMember" : "deleteMember",
                memberId: memberId
            }),
            timeout: 30000
        })
            .done(function (res) {
                let response = parseResponse(res);

                if (response.error) {
                    showError(response.error);
                } else {
                    showSuccess(deactivateOnly ? "Member deactivated!" : "Member deleted!");
                    closeDeleteModal();
                    fetchMembers();
                }
            })
            .fail(function (xhr, status, error) {
                showError("Failed to process: " + (error || status));
            })
            .always(function () {
                $("#confirmDeleteBtn").prop("disabled", false).text("Delete");
            });
    }


    // =========================================================
    // RENDER TEAM GRID
    // =========================================================
    function renderTeamGrid() {
        const grid = $("#teamGrid");
        grid.empty();

        if (membersData.length === 0) {
            $("#emptyState").removeClass("hidden");
            $("#noResultsState").addClass("hidden");
            return;
        }

        if (filteredData.length === 0) {
            $("#emptyState").addClass("hidden");
            $("#noResultsState").removeClass("hidden");
            return;
        }

        $("#emptyState").addClass("hidden");
        $("#noResultsState").addClass("hidden");

        filteredData.forEach(function (member, index) {
            const card = createMemberCard(member, index);
            grid.append(card);
        });
    }


    // =========================================================
    // CREATE MEMBER CARD
    // =========================================================
    function createMemberCard(member, index) {
        const photoUrl = member.photoURL || getAvatarUrl(member.name);
        const roleClass = getRoleBadgeClass(member.role);
        const statusClass = getStatusChipClass(member.status);
        const joinDate = formatDate(member.joinDate);

        return `
            <div class="bg-white rounded-xl shadow-sm overflow-hidden card-hover transition-all duration-300 fade-in" 
                 style="animation-delay: ${index * 50}ms"
                 data-member-id="${escapeHtml(member.memberId)}">
                
                <!-- Card Header -->
                <div class="relative h-24 bg-gradient-to-r from-purple-500 to-indigo-500">
                    <div class="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
                        <img src="${escapeHtml(photoUrl)}" 
                             alt="${escapeHtml(member.name)}"
                             class="w-20 h-20 rounded-full border-4 border-white object-cover bg-white"
                             onerror="this.src='${getAvatarUrl(member.name)}'">
                    </div>
                </div>

                <!-- Card Body -->
                <div class="pt-12 pb-4 px-4 text-center">
                    <h3 class="font-bold text-gray-800 text-lg">${escapeHtml(member.name)}</h3>
                    
                    <div class="flex justify-center gap-2 mt-2">
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${roleClass}">
                            ${escapeHtml(member.role)}
                        </span>
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${statusClass}">
                            ${escapeHtml(member.status)}
                        </span>
                    </div>

                    <p class="text-gray-500 text-sm mt-3 truncate" title="${escapeHtml(member.email)}">
                        ${escapeHtml(member.email)}
                    </p>

                    <p class="text-gray-400 text-xs mt-1">
                        Joined ${joinDate}
                    </p>
                </div>

                <!-- Card Actions -->
                <div class="border-t px-4 py-3 flex justify-center gap-2">
                    <button class="btn-view-profile px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                            data-member-id="${escapeHtml(member.memberId)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        View
                    </button>
                    <button class="btn-edit-member px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                            data-member-id="${escapeHtml(member.memberId)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Edit
                    </button>
                    <button class="btn-delete-member px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                            data-member-id="${escapeHtml(member.memberId)}"
                            data-member-name="${escapeHtml(member.name)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }


    // =========================================================
    // UPDATE STATISTICS
    // =========================================================
    function updateStatistics() {
        const stats = calculateStats();

        // Update stat cards
        $("#statTotal").text(stats.total);
        $("#statActive").text(stats.active);
        $("#statLeave").text(stats.leave);
        $("#statInactive").text(stats.inactive);

        // Update quick stats
        $("#statDevelopers").text(stats.roles.Developer || 0);
        $("#statDesigners").text(stats.roles.Designer || 0);
        $("#statVideoEditors").text(stats.roles["Video Editor"] || 0);
        $("#statOthers").text(stats.roles.other || 0);

        // Update charts
        updateCharts(stats);
    }


    // =========================================================
    // CALCULATE STATISTICS
    // =========================================================
    function calculateStats() {
        const stats = {
            total: membersData.length,
            active: 0,
            leave: 0,
            inactive: 0,
            roles: {}
        };

        membersData.forEach(function (member) {
            // Status count
            const status = (member.status || "").toLowerCase();
            if (status === "active") stats.active++;
            else if (status === "leave") stats.leave++;
            else if (status === "inactive") stats.inactive++;

            // Role count
            const role = member.role || "Other";
            if (!stats.roles[role]) {
                stats.roles[role] = 0;
            }
            stats.roles[role]++;
        });

        // Count others (non-standard roles)
        const standardRoles = ["Developer", "Designer", "Video Editor", "Manager", "Admin"];
        stats.roles.other = 0;
        Object.keys(stats.roles).forEach(function (role) {
            if (!standardRoles.includes(role) && role !== "other") {
                stats.roles.other += stats.roles[role];
            }
        });

        return stats;
    }


    // =========================================================
    // UPDATE CHARTS
    // =========================================================
    function updateCharts(stats) {
        // Role Distribution Chart
        const roleCtx = document.getElementById("roleChart");
        if (roleCtx) {
            if (roleChart) roleChart.destroy();

            const roleLabels = Object.keys(stats.roles).filter(r => r !== "other" && stats.roles[r] > 0);
            const roleData = roleLabels.map(r => stats.roles[r]);
            const roleColors = roleLabels.map(r => getRoleColor(r));

            roleChart = new Chart(roleCtx, {
                type: "doughnut",
                data: {
                    labels: roleLabels,
                    datasets: [{
                        data: roleData,
                        backgroundColor: roleColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                boxWidth: 12,
                                padding: 15
                            }
                        }
                    }
                }
            });
        }

        // Status Overview Chart
        const statusCtx = document.getElementById("statusChart");
        if (statusCtx) {
            if (statusChart) statusChart.destroy();

            statusChart = new Chart(statusCtx, {
                type: "doughnut",
                data: {
                    labels: ["Active", "On Leave", "Inactive"],
                    datasets: [{
                        data: [stats.active, stats.leave, stats.inactive],
                        backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                boxWidth: 12,
                                padding: 15
                            }
                        }
                    }
                }
            });
        }
    }


    // =========================================================
    // SEARCH & FILTER
    // =========================================================
    function applyFilters() {
        const searchTerm = $("#searchInput").val().toLowerCase().trim();
        const roleFilter = $("#filterRole").val();
        const statusFilter = $("#filterStatus").val();
        const sortBy = $("#sortBy").val();

        // Filter
        filteredData = membersData.filter(function (member) {
            // Search filter
            const matchesSearch = !searchTerm ||
                (member.name || "").toLowerCase().includes(searchTerm) ||
                (member.email || "").toLowerCase().includes(searchTerm) ||
                (member.memberId || "").toLowerCase().includes(searchTerm);

            // Role filter
            const matchesRole = !roleFilter || member.role === roleFilter;

            // Status filter
            const matchesStatus = !statusFilter || member.status === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });

        // Sort
        filteredData.sort(function (a, b) {
            switch (sortBy) {
                case "name":
                    return (a.name || "").localeCompare(b.name || "");
                case "role":
                    return (a.role || "").localeCompare(b.role || "");
                case "joinDate":
                    return new Date(b.joinDate || 0) - new Date(a.joinDate || 0);
                case "status":
                    return (a.status || "").localeCompare(b.status || "");
                default:
                    return 0;
            }
        });

        renderTeamGrid();
    }


    // =========================================================
    // MODAL HANDLERS
    // =========================================================

    function openAddModal() {
        $("#formMode").val("add");
        $("#formMemberId").val("");
        $("#modalTitle").text("Add New Member");
        $("#submitText").text("Add Member");
        resetForm();
        setDefaultJoinDate();
        $("#memberModal").removeClass("hidden");
    }

    function openEditModal(memberId) {
        const member = membersData.find(m => m.memberId === memberId);
        if (!member) {
            showError("Member not found");
            return;
        }

        currentMember = member;
        $("#formMode").val("edit");
        $("#formMemberId").val(member.memberId);
        $("#modalTitle").text("Edit Member");
        $("#submitText").text("Update Member");

        // Populate form
        $("#formName").val(member.name || "");
        $("#formEmail").val(member.email || "");
        $("#formRole").val(member.role || "");
        $("#formStatus").val(member.status || "Active");
        $("#formPhotoURL").val(member.photoURL || "");
        $("#formJoinDate").val(formatDateForInput(member.joinDate));
        $("#formNotes").val(member.notes || "");

        // Update preview
        updatePhotoPreview();

        $("#memberModal").removeClass("hidden");
    }

    function closeModal() {
        $("#memberModal").addClass("hidden");
        resetForm();
    }

    function openProfileModal(memberId) {
        const member = membersData.find(m => m.memberId === memberId);
        if (!member) {
            showError("Member not found");
            return;
        }

        currentMember = member;

        // Populate profile modal
        const photoUrl = member.photoURL || getAvatarUrl(member.name);
        $("#profilePhoto").attr("src", photoUrl);
        $("#profileName").text(member.name || "Unknown");
        $("#profileRole").text(member.role || "No role");
        $("#profileStatus").text(member.status || "Unknown").attr("class", `inline-block mt-3 px-3 py-1 rounded-full text-sm font-medium ${getStatusChipClass(member.status)}`);
        $("#profileEmail").text(member.email || "No email");
        $("#profileJoinDate").text(formatDate(member.joinDate));
        $("#profileMemberId").text(member.memberId || "N/A");

        if (member.notes) {
            $("#profileNotesContainer").removeClass("hidden");
            $("#profileNotes").text(member.notes);
        } else {
            $("#profileNotesContainer").addClass("hidden");
        }

        $("#profileModal").removeClass("hidden");
    }

    function closeProfileModal() {
        $("#profileModal").addClass("hidden");
        currentMember = null;
    }

    function openDeleteModal(memberId, memberName) {
        currentMember = { memberId, name: memberName };
        $("#deleteMessage").text(`Are you sure you want to remove "${memberName}"? This action cannot be undone.`);
        $("#deactivateInstead").prop("checked", false);
        $("#deleteModal").removeClass("hidden");
    }

    function closeDeleteModal() {
        $("#deleteModal").addClass("hidden");
        currentMember = null;
    }


    // =========================================================
    // FORM HANDLERS
    // =========================================================

    function handleFormSubmit(e) {
        e.preventDefault();

        const mode = $("#formMode").val();
        const memberId = $("#formMemberId").val();

        const memberData = {
            name: $("#formName").val().trim(),
            email: $("#formEmail").val().trim(),
            role: $("#formRole").val(),
            status: $("#formStatus").val(),
            photoURL: $("#formPhotoURL").val().trim(),
            joinDate: $("#formJoinDate").val(),
            notes: $("#formNotes").val().trim()
        };

        // Validation
        if (!memberData.name) {
            showError("Name is required");
            return;
        }

        if (!memberData.email || !isValidEmail(memberData.email)) {
            showError("Valid email is required");
            return;
        }

        if (!memberData.role) {
            showError("Role is required");
            return;
        }

        // Check for duplicate email (except current member)
        const duplicateEmail = membersData.find(m =>
            m.email.toLowerCase() === memberData.email.toLowerCase() &&
            m.memberId !== memberId
        );

        if (duplicateEmail) {
            showError("Email already exists for another member");
            return;
        }

        if (mode === "add") {
            addMember(memberData);
        } else {
            updateMember(memberId, memberData);
        }
    }

    function resetForm() {
        $("#memberForm")[0].reset();
        $("#formMemberId").val("");
        $("#formMode").val("add");
        $("#photoPreview").attr("src", "https://ui-avatars.com/api/?name=New+Member&background=8b5cf6&color=fff&size=128");
    }

    function setDefaultJoinDate() {
        const today = new Date().toISOString().split("T")[0];
        $("#formJoinDate").val(today);
    }

    function updatePhotoPreview() {
        const url = $("#formPhotoURL").val().trim();
        const name = $("#formName").val().trim() || "Member";

        if (url) {
            $("#photoPreview").attr("src", url);
        } else {
            $("#photoPreview").attr("src", getAvatarUrl(name));
        }
    }


    // =========================================================
    // UI HELPERS
    // =========================================================

    function showLoader() {
        $("#loader").removeClass("hidden");
        $("#teamGrid").addClass("hidden");
    }

    function hideLoader() {
        $("#loader").addClass("hidden");
        $("#teamGrid").removeClass("hidden");
    }

    function showError(message) {
        $("#errorText").text(message);
        $("#errorMessage").removeClass("hidden");
        setTimeout(hideError, 5000);
    }

    function hideError() {
        $("#errorMessage").addClass("hidden");
    }

    function showSuccess(message) {
        $("#successText").text(message);
        $("#successMessage").removeClass("hidden");
        setTimeout(hideSuccess, 3000);
    }

    function hideSuccess() {
        $("#successMessage").addClass("hidden");
    }

    function showModalLoading(isLoading) {
        if (isLoading) {
            $("#submitBtn").prop("disabled", true);
            $("#submitText").text("Processing...");
        } else {
            $("#submitBtn").prop("disabled", false);
            const mode = $("#formMode").val();
            $("#submitText").text(mode === "edit" ? "Update Member" : "Add Member");
        }
    }

    function updateLastSyncTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
        });
        $("#lastSyncTime").text(timeStr);
    }


    // =========================================================
    // UTILITY FUNCTIONS
    // =========================================================

    function parseResponse(res) {
        if (typeof res === "string") {
            try {
                return JSON.parse(res);
            } catch (e) {
                return { error: "Invalid response" };
            }
        }
        return res;
    }

    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function getAvatarUrl(name) {
        const encoded = encodeURIComponent(name || "User");
        return `https://ui-avatars.com/api/?name=${encoded}&background=8b5cf6&color=fff&size=128`;
    }

    function getRoleBadgeClass(role) {
        const roleMap = {
            "Developer": "badge-developer",
            "Designer": "badge-designer",
            "Video Editor": "badge-video-editor",
            "Manager": "badge-manager",
            "Admin": "badge-admin"
        };
        return roleMap[role] || "bg-gray-500 text-white";
    }

    function getRoleColor(role) {
        const colorMap = {
            "Developer": "#3b82f6",
            "Designer": "#10b981",
            "Video Editor": "#8b5cf6",
            "Manager": "#f59e0b",
            "Admin": "#ef4444"
        };
        return colorMap[role] || "#6b7280";
    }

    function getStatusChipClass(status) {
        const statusMap = {
            "Active": "status-active",
            "Leave": "status-leave",
            "Inactive": "status-inactive"
        };
        return statusMap[status] || "bg-gray-200 text-gray-700";
    }

    function formatDate(dateValue) {
        if (!dateValue) return "Unknown";

        let date;
        if (dateValue instanceof Date) {
            date = dateValue;
        } else {
            date = new Date(dateValue);
        }

        if (isNaN(date.getTime())) return "Unknown";

        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function formatDateForInput(dateValue) {
        if (!dateValue) return "";

        let date;
        if (dateValue instanceof Date) {
            date = dateValue;
        } else {
            date = new Date(dateValue);
        }

        if (isNaN(date.getTime())) return "";

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}`;
    }


    // =========================================================
    // EVENT LISTENERS
    // =========================================================

    function attachEventListeners() {

        // Search & Filter
        $("#searchInput").on("input", debounce(applyFilters, 300));
        $("#filterRole, #filterStatus, #sortBy").on("change", applyFilters);

        // Refresh
        $("#refreshBtn").on("click", fetchMembers);

        // Add Member buttons
        $("#addMemberBtn, #emptyAddBtn").on("click", openAddModal);

        // Modal close buttons
        $("#closeModal, #cancelModalBtn").on("click", closeModal);
        $("#closeProfileModal").on("click", closeProfileModal);
        $("#cancelDeleteBtn").on("click", closeDeleteModal);

        // Form submit
        $("#memberForm").on("submit", handleFormSubmit);

        // Photo URL change
        $("#formPhotoURL, #formName").on("input", debounce(updatePhotoPreview, 500));

        // Delete confirmation
        $("#confirmDeleteBtn").on("click", function () {
            if (currentMember) {
                const deactivate = $("#deactivateInstead").is(":checked");
                deleteMember(currentMember.memberId, deactivate);
            }
        });

        // Profile edit button
        $("#profileEditBtn").on("click", function () {
            if (currentMember) {
                closeProfileModal();
                openEditModal(currentMember.memberId);
            }
        });

        // Card action buttons (delegated)
        $(document).on("click", ".btn-view-profile", function () {
            const memberId = $(this).data("member-id");
            openProfileModal(memberId);
        });

        $(document).on("click", ".btn-edit-member", function () {
            const memberId = $(this).data("member-id");
            openEditModal(memberId);
        });

        $(document).on("click", ".btn-delete-member", function () {
            const memberId = $(this).data("member-id");
            const memberName = $(this).data("member-name");
            openDeleteModal(memberId, memberName);
        });

        // Close modals on backdrop click
        $("#memberModal, #profileModal, #deleteModal").on("click", function (e) {
            if (e.target === this) {
                $(this).addClass("hidden");
            }
        });

        // ESC key closes modals
        $(document).on("keydown", function (e) {
            if (e.key === "Escape") {
                closeModal();
                closeProfileModal();
                closeDeleteModal();
            }
        });

        // Close messages
        $("#closeError").on("click", hideError);
        $("#closeSuccess").on("click", hideSuccess);
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

});