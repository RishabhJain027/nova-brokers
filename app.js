/* ════════════════════════════════════════════════════════════════
   NOVA BROKERS — Interactive Property Explorer
   Application Logic
   ════════════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ── State ──
    const state = {
        allProperties: [],
        filtered: [],
        meta: {},
        page: 1,
        perPage: 18,
        sort: 'amount_asc',
        search: '',
        filters: {
            location: '',
            bhk: [],
            budgetMin: null,
            budgetMax: null,
            areaMin: null,
            areaMax: null,
            furnishing: '',
            transaction: '',
            facing: '',
            ownership: '',
            bathroom: '',
        },
        selected: new Map(),  // id → property object
    };

    // ── DOM Cache ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        loadingScreen: $('#loadingScreen'),
        searchInput: $('#searchInput'),
        searchClear: $('#searchClear'),
        scrollIndicator: $('#scrollIndicator'),
        totalCount: $('#totalCount'),
        cityCount: $('#cityCount'),
        filtersPanel: $('#filtersPanel'),
        toggleFilters: $('#toggleFilters'),
        resetFilters: $('#resetFilters'),
        filterLocation: $('#filterLocation'),
        bhkChips: $('#bhkChips'),
        budgetMin: $('#budgetMin'),
        budgetMax: $('#budgetMax'),
        areaMin: $('#areaMin'),
        areaMax: $('#areaMax'),
        filterFurnishing: $('#filterFurnishing'),
        filterTransaction: $('#filterTransaction'),
        filterFacing: $('#filterFacing'),
        filterOwnership: $('#filterOwnership'),
        filterBathroom: $('#filterBathroom'),
        activeFilters: $('#activeFilters'),
        resultsCount: $('#resultsCount'),
        sortSelect: $('#sortSelect'),
        propertyGrid: $('#propertyGrid'),
        pagination: $('#pagination'),
        noResults: $('#noResults'),
        modalOverlay: $('#modalOverlay'),
        modalBody: $('#modalBody'),
        modalClose: $('#modalClose'),
        selectionPanel: $('#selectionPanel'),
        selectionCount: $('#selectionCount'),
        selectionList: $('#selectionList'),
        selectionTotals: $('#selectionTotals'),
        clearSelection: $('#clearSelection'),
        exportSelection: $('#exportSelection'),
        fabSelection: $('#fabSelection'),
        fabBadge: $('#fabBadge'),
    };


    // ════════════════════════════════════════════════════════════
    // DATA LOADING
    // ════════════════════════════════════════════════════════════

    function loadData() {
        try {
            const data = typeof PROPERTY_DATA !== 'undefined' ? PROPERTY_DATA : null;
            if (!data) throw new Error('PROPERTY_DATA not found. Ensure data.js is loaded.');

            state.meta = data.meta;
            state.allProperties = data.properties.map((p, i) => ({
                ...p,
                _id: i,
                amount_lac: parseFloat(p.amount_lac) || 0,
                carpet_area: parseInt(p.carpet_area) || 0,
                super_area: parseInt(p.super_area) || 0,
                price_per_sqft: parseInt(p.price_per_sqft) || 0,
                bathroom: parseInt(p.bathroom) || 0,
                balcony: parseInt(p.balcony) || 0,
            }));

            initFilters();
            applyFilters();
            hideLoading();
        } catch (err) {
            console.error('Failed to load data:', err);
            dom.loadingScreen.innerHTML = `
                <div class="loader">
                    <span style="color:#FF6B6B;">Failed to load data: ${err.message}</span>
                </div>`;
        }
    }

    function hideLoading() {
        dom.loadingScreen.classList.add('hidden');
        setTimeout(() => dom.loadingScreen.remove(), 500);
    }


    // ════════════════════════════════════════════════════════════
    // FILTER INITIALIZATION
    // ════════════════════════════════════════════════════════════

    function initFilters() {
        const { meta } = state;

        // Header stats
        dom.totalCount.textContent = meta.total.toLocaleString();
        dom.cityCount.textContent = meta.locations.length;

        // Location dropdown
        meta.locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc;
            opt.textContent = loc;
            dom.filterLocation.appendChild(opt);
        });

        // BHK chips
        meta.bhks.filter(b => b !== 'N/A').forEach(bhk => {
            const chip = document.createElement('button');
            chip.className = 'chip';
            chip.dataset.bhk = bhk;
            chip.textContent = `${bhk} BHK`;
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
                const idx = state.filters.bhk.indexOf(bhk);
                if (idx > -1) state.filters.bhk.splice(idx, 1);
                else state.filters.bhk.push(bhk);
                onFilterChange();
            });
            dom.bhkChips.appendChild(chip);
        });

        // Furnishing
        meta.furnishings.filter(f => f !== 'Not Specified').forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            dom.filterFurnishing.appendChild(opt);
        });

        // Transaction
        meta.transactions.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            dom.filterTransaction.appendChild(opt);
        });

        // Facing
        meta.facings.filter(f => f !== 'Not Specified').forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            dom.filterFacing.appendChild(opt);
        });

        // Ownership
        meta.ownerships.filter(o => o !== 'Not Specified').forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.textContent = o;
            dom.filterOwnership.appendChild(opt);
        });
    }


    // ════════════════════════════════════════════════════════════
    // FILTERING & SORTING
    // ════════════════════════════════════════════════════════════

    function applyFilters() {
        const f = state.filters;
        const q = state.search.toLowerCase().trim();

        let results = state.allProperties.filter(p => {
            // Text search
            if (q) {
                const haystack = `${p.title} ${p.location} ${p.society}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }

            // Location
            if (f.location && p.location !== f.location) return false;

            // BHK
            if (f.bhk.length > 0 && !f.bhk.includes(p.bhk)) return false;

            // Budget
            if (f.budgetMin !== null && p.amount_lac < f.budgetMin) return false;
            if (f.budgetMax !== null && p.amount_lac > f.budgetMax) return false;

            // Carpet area
            if (f.areaMin !== null && p.carpet_area < f.areaMin) return false;
            if (f.areaMax !== null && p.carpet_area > f.areaMax) return false;

            // Furnishing
            if (f.furnishing && p.furnishing !== f.furnishing) return false;

            // Transaction
            if (f.transaction && p.transaction !== f.transaction) return false;

            // Facing
            if (f.facing && p.facing !== f.facing) return false;

            // Ownership
            if (f.ownership && p.ownership !== f.ownership) return false;

            // Bathroom
            if (f.bathroom) {
                if (f.bathroom === '4') {
                    if (p.bathroom < 4) return false;
                } else {
                    if (p.bathroom !== parseInt(f.bathroom)) return false;
                }
            }

            return true;
        });

        // Sort
        results = sortProperties(results, state.sort);

        state.filtered = results;
        state.page = 1;

        renderResults();
        renderActiveFilters();
    }

    function sortProperties(arr, sortKey) {
        const copy = [...arr];
        switch (sortKey) {
            case 'amount_asc':
                return copy.sort((a, b) => a.amount_lac - b.amount_lac);
            case 'amount_desc':
                return copy.sort((a, b) => b.amount_lac - a.amount_lac);
            case 'area_desc':
                return copy.sort((a, b) => b.carpet_area - a.carpet_area);
            case 'area_asc':
                return copy.sort((a, b) => a.carpet_area - b.carpet_area);
            case 'ppsqft_asc':
                return copy.sort((a, b) => a.price_per_sqft - b.price_per_sqft);
            case 'ppsqft_desc':
                return copy.sort((a, b) => b.price_per_sqft - a.price_per_sqft);
            default:
                return copy;
        }
    }

    function onFilterChange() {
        state.filters.location = dom.filterLocation.value;
        state.filters.budgetMin = dom.budgetMin.value ? parseFloat(dom.budgetMin.value) : null;
        state.filters.budgetMax = dom.budgetMax.value ? parseFloat(dom.budgetMax.value) : null;
        state.filters.areaMin = dom.areaMin.value ? parseInt(dom.areaMin.value) : null;
        state.filters.areaMax = dom.areaMax.value ? parseInt(dom.areaMax.value) : null;
        state.filters.furnishing = dom.filterFurnishing.value;
        state.filters.transaction = dom.filterTransaction.value;
        state.filters.facing = dom.filterFacing.value;
        state.filters.ownership = dom.filterOwnership.value;
        state.filters.bathroom = dom.filterBathroom.value;
        applyFilters();
    }


    // ════════════════════════════════════════════════════════════
    // RENDERING — CARDS
    // ════════════════════════════════════════════════════════════

    function formatPrice(lac) {
        if (lac >= 100) return `₹${(lac / 100).toFixed(2)} Cr`;
        return `₹${lac.toFixed(lac % 1 === 0 ? 0 : 1)} Lac`;
    }

    function renderResults() {
        const { filtered, page, perPage } = state;
        const total = filtered.length;
        const start = (page - 1) * perPage;
        const pageItems = filtered.slice(start, start + perPage);

        // Results count
        dom.resultsCount.innerHTML = total > 0
            ? `Showing <strong>${start + 1}–${Math.min(start + perPage, total)}</strong> of <strong>${total.toLocaleString()}</strong> properties`
            : 'No properties found';

        // No results
        dom.noResults.style.display = total === 0 ? 'block' : 'none';
        dom.propertyGrid.style.display = total === 0 ? 'none' : 'grid';

        // Cards
        dom.propertyGrid.innerHTML = pageItems.map((p, i) => {
            const isSelected = state.selected.has(p._id);
            const area = p.carpet_area > 0 ? `${p.carpet_area.toLocaleString()} sqft` : (p.super_area > 0 ? `${p.super_area.toLocaleString()} sqft` : '—');
            const tags = [p.furnishing, p.transaction, p.facing].filter(t => t && t !== 'Not Specified');

            return `
                <article class="property-card" data-id="${p._id}" style="animation-delay: ${i * 0.04}s">
                    <div class="card-header">
                        <span class="card-bhk-badge">${p.bhk !== 'N/A' ? p.bhk + ' BHK' : 'Property'}</span>
                        <h3 class="card-title">${escapeHtml(p.title)}</h3>
                        <div class="card-location">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${escapeHtml(p.location)}
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="card-stats">
                            <div class="card-stat">
                                <div class="card-stat-value">${area}</div>
                                <div class="card-stat-label">Area</div>
                            </div>
                            <div class="card-stat">
                                <div class="card-stat-value">${p.bathroom || '—'}</div>
                                <div class="card-stat-label">Bath</div>
                            </div>
                            <div class="card-stat">
                                <div class="card-stat-value">${p.balcony || '—'}</div>
                                <div class="card-stat-label">Balcony</div>
                            </div>
                        </div>
                    </div>
                    ${tags.length > 0 ? `
                        <div class="card-tags">
                            ${tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="card-footer">
                        <div>
                            <div class="card-price">${formatPrice(p.amount_lac)}</div>
                            ${p.price_per_sqft > 0 ? `<div class="card-price-sub">₹${p.price_per_sqft.toLocaleString()}/sqft</div>` : ''}
                        </div>
                        <div class="card-actions">
                            <button class="btn-select ${isSelected ? 'selected' : ''}"
                                    data-select-id="${p._id}"
                                    onclick="event.stopPropagation()">
                                ${isSelected ? '✓ Selected' : '+ Select'}
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        // Card click → open modal
        dom.propertyGrid.querySelectorAll('.property-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                openModal(state.allProperties[id]);
            });
        });

        // Select buttons
        dom.propertyGrid.querySelectorAll('.btn-select').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.selectId);
                toggleSelection(id);
            });
        });

        renderPagination();
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }


    // ════════════════════════════════════════════════════════════
    // PAGINATION
    // ════════════════════════════════════════════════════════════

    function renderPagination() {
        const { filtered, page, perPage } = state;
        const totalPages = Math.ceil(filtered.length / perPage);
        if (totalPages <= 1) { dom.pagination.innerHTML = ''; return; }

        let html = '';

        // Previous
        html += `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>`;

        // Pages
        const range = getPageRange(page, totalPages);
        range.forEach(p => {
            if (p === '...') {
                html += `<span class="page-ellipsis">…</span>`;
            } else {
                html += `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
            }
        });

        // Next
        html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>`;

        dom.pagination.innerHTML = html;

        dom.pagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                state.page = parseInt(btn.dataset.page);
                renderResults();
                // Scroll to results top
                document.querySelector('.results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function getPageRange(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = [];
        pages.push(1);
        if (current > 3) pages.push('...');
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
            pages.push(i);
        }
        if (current < total - 2) pages.push('...');
        pages.push(total);
        return pages;
    }


    // ════════════════════════════════════════════════════════════
    // ACTIVE FILTER TAGS
    // ════════════════════════════════════════════════════════════

    function renderActiveFilters() {
        const f = state.filters;
        const tags = [];

        if (f.location) tags.push({ key: 'location', label: `📍 ${f.location}` });
        f.bhk.forEach(b => tags.push({ key: `bhk-${b}`, label: `${b} BHK` }));
        if (f.budgetMin !== null) tags.push({ key: 'budgetMin', label: `Min ₹${f.budgetMin} Lac` });
        if (f.budgetMax !== null) tags.push({ key: 'budgetMax', label: `Max ₹${f.budgetMax} Lac` });
        if (f.areaMin !== null) tags.push({ key: 'areaMin', label: `Min ${f.areaMin} sqft` });
        if (f.areaMax !== null) tags.push({ key: 'areaMax', label: `Max ${f.areaMax} sqft` });
        if (f.furnishing) tags.push({ key: 'furnishing', label: f.furnishing });
        if (f.transaction) tags.push({ key: 'transaction', label: f.transaction });
        if (f.facing) tags.push({ key: 'facing', label: f.facing });
        if (f.ownership) tags.push({ key: 'ownership', label: f.ownership });
        if (f.bathroom) tags.push({ key: 'bathroom', label: `${f.bathroom}${f.bathroom === '4' ? '+' : ''} Bath` });
        if (state.search) tags.push({ key: 'search', label: `🔍 "${state.search}"` });

        dom.activeFilters.innerHTML = tags.map(t => `
            <span class="filter-tag">
                ${t.label}
                <span class="filter-tag-remove" data-key="${t.key}">×</span>
            </span>
        `).join('');

        dom.activeFilters.querySelectorAll('.filter-tag-remove').forEach(btn => {
            btn.addEventListener('click', () => removeFilter(btn.dataset.key));
        });
    }

    function removeFilter(key) {
        if (key === 'location') { dom.filterLocation.value = ''; }
        else if (key.startsWith('bhk-')) {
            const bhk = key.split('-')[1];
            const idx = state.filters.bhk.indexOf(bhk);
            if (idx > -1) state.filters.bhk.splice(idx, 1);
            dom.bhkChips.querySelectorAll('.chip').forEach(c => {
                if (c.dataset.bhk === bhk) c.classList.remove('active');
            });
        }
        else if (key === 'budgetMin') { dom.budgetMin.value = ''; }
        else if (key === 'budgetMax') { dom.budgetMax.value = ''; }
        else if (key === 'areaMin') { dom.areaMin.value = ''; }
        else if (key === 'areaMax') { dom.areaMax.value = ''; }
        else if (key === 'furnishing') { dom.filterFurnishing.value = ''; }
        else if (key === 'transaction') { dom.filterTransaction.value = ''; }
        else if (key === 'facing') { dom.filterFacing.value = ''; }
        else if (key === 'ownership') { dom.filterOwnership.value = ''; }
        else if (key === 'bathroom') { dom.filterBathroom.value = ''; }
        else if (key === 'search') { dom.searchInput.value = ''; state.search = ''; dom.searchClear.classList.remove('visible'); }

        onFilterChange();
    }


    // ════════════════════════════════════════════════════════════
    // MODAL
    // ════════════════════════════════════════════════════════════

    function openModal(p) {
        const isSelected = state.selected.has(p._id);
        const area = p.carpet_area > 0 ? `${p.carpet_area.toLocaleString()} sqft` : '—';

        dom.modalBody.innerHTML = `
            <h2 class="modal-title">${escapeHtml(p.title)}</h2>
            <div class="modal-location">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                ${escapeHtml(p.location)}
            </div>

            <div class="modal-price-block">
                <span class="modal-price">${formatPrice(p.amount_lac)}</span>
                ${p.price_per_sqft > 0 ? `<span class="modal-price-unit">@ ₹${p.price_per_sqft.toLocaleString()}/sqft</span>` : ''}
            </div>

            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Carpet Area</div>
                    <div class="modal-detail-value">${area}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Super Area</div>
                    <div class="modal-detail-value">${p.super_area > 0 ? p.super_area.toLocaleString() + ' sqft' : '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">BHK</div>
                    <div class="modal-detail-value">${p.bhk !== 'N/A' ? p.bhk + ' BHK' : '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Bathrooms</div>
                    <div class="modal-detail-value">${p.bathroom || '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Balconies</div>
                    <div class="modal-detail-value">${p.balcony || '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Furnishing</div>
                    <div class="modal-detail-value">${p.furnishing || '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Transaction</div>
                    <div class="modal-detail-value">${p.transaction || '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Facing</div>
                    <div class="modal-detail-value">${p.facing || '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Ownership</div>
                    <div class="modal-detail-value">${p.ownership || '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Floor</div>
                    <div class="modal-detail-value">${p.floor || '—'}</div>
                </div>
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Car Parking</div>
                    <div class="modal-detail-value">${p.car_parking && p.car_parking !== 'N/A' ? p.car_parking : '—'}</div>
                </div>
                ${p.society ? `
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Society</div>
                    <div class="modal-detail-value">${escapeHtml(p.society)}</div>
                </div>` : ''}
                ${p.overlooking ? `
                <div class="modal-detail-item">
                    <div class="modal-detail-label">Overlooking</div>
                    <div class="modal-detail-value">${escapeHtml(p.overlooking)}</div>
                </div>` : ''}
            </div>

            <button class="modal-select-btn ${isSelected ? 'selected' : ''}" id="modalSelectBtn" data-id="${p._id}">
                ${isSelected ? '✓ Selected — Remove from Selection' : '+ Add to My Selection'}
            </button>
        `;

        // Modal select button
        const modalBtn = dom.modalBody.querySelector('#modalSelectBtn');
        modalBtn.addEventListener('click', () => {
            toggleSelection(p._id);
            const nowSelected = state.selected.has(p._id);
            modalBtn.className = `modal-select-btn ${nowSelected ? 'selected' : ''}`;
            modalBtn.textContent = nowSelected ? '✓ Selected — Remove from Selection' : '+ Add to My Selection';
        });

        dom.modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        dom.modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }


    // ════════════════════════════════════════════════════════════
    // SELECTION MANAGEMENT
    // ════════════════════════════════════════════════════════════

    function toggleSelection(id) {
        if (state.selected.has(id)) {
            state.selected.delete(id);
        } else {
            state.selected.set(id, state.allProperties[id]);
        }
        updateSelectionUI();
        renderResults();  // re-render to update button states
    }

    function updateSelectionUI() {
        const count = state.selected.size;

        // Badge
        dom.fabBadge.textContent = count;
        dom.fabBadge.className = `fab-badge ${count === 0 ? 'empty' : ''}`;
        dom.selectionCount.textContent = count;

        // Selection list
        if (count === 0) {
            dom.selectionList.innerHTML = `
                <div style="text-align:center; padding:3rem 1rem; color: var(--clr-text-muted);">
                    <p>No properties selected yet.</p>
                    <p style="font-size:0.78rem; margin-top:0.5rem;">Click "+ Select" on any property card.</p>
                </div>
            `;
            dom.selectionTotals.innerHTML = '';
            return;
        }

        let totalAmount = 0;
        let totalArea = 0;
        let areaCount = 0;

        dom.selectionList.innerHTML = '';
        state.selected.forEach((p, id) => {
            totalAmount += p.amount_lac;
            if (p.carpet_area > 0) { totalArea += p.carpet_area; areaCount++; }

            const item = document.createElement('div');
            item.className = 'selection-item';
            item.innerHTML = `
                <div class="selection-item-info">
                    <div class="selection-item-title">${escapeHtml(p.title)}</div>
                    <div class="selection-item-meta">${escapeHtml(p.location)} · ${p.bhk !== 'N/A' ? p.bhk + ' BHK' : ''} · ${p.carpet_area > 0 ? p.carpet_area + ' sqft' : ''}</div>
                </div>
                <div class="selection-item-price">${formatPrice(p.amount_lac)}</div>
                <button class="selection-item-remove" data-id="${id}" title="Remove">×</button>
            `;
            dom.selectionList.appendChild(item);
        });

        // Remove buttons in selection list
        dom.selectionList.querySelectorAll('.selection-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleSelection(parseInt(btn.dataset.id));
            });
        });

        // Totals
        const avgPrice = totalAmount / count;
        dom.selectionTotals.innerHTML = `
            <strong>${count}</strong> properties selected<br>
            Total value: <strong>${formatPrice(totalAmount)}</strong><br>
            Avg price: <strong>${formatPrice(avgPrice)}</strong>
            ${areaCount > 0 ? `<br>Avg area: <strong>${Math.round(totalArea / areaCount).toLocaleString()} sqft</strong>` : ''}
        `;
    }

    function clearAllSelections() {
        state.selected.clear();
        updateSelectionUI();
        renderResults();
    }

    function exportSelectionData() {
        if (state.selected.size === 0) return;

        const rows = [];
        const headers = ['Title', 'Location', 'BHK', 'Amount (Lac)', 'Price/sqft', 'Carpet Area', 'Super Area',
                         'Bathrooms', 'Balconies', 'Furnishing', 'Transaction', 'Facing', 'Ownership',
                         'Floor', 'Society', 'Car Parking'];
        rows.push(headers.join(','));

        state.selected.forEach(p => {
            rows.push([
                `"${(p.title || '').replace(/"/g, '""')}"`,
                `"${p.location}"`,
                p.bhk,
                p.amount_lac,
                p.price_per_sqft,
                p.carpet_area,
                p.super_area,
                p.bathroom,
                p.balcony,
                `"${p.furnishing}"`,
                `"${p.transaction}"`,
                `"${p.facing}"`,
                `"${p.ownership}"`,
                `"${(p.floor || '').replace(/"/g, '""')}"`,
                `"${(p.society || '').replace(/"/g, '""')}"`,
                `"${(p.car_parking || '').replace(/"/g, '""')}"`,
            ].join(','));
        });

        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nova_brokers_selection_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }


    // ════════════════════════════════════════════════════════════
    // EVENT BINDINGS
    // ════════════════════════════════════════════════════════════

    function bindEvents() {
        // Search
        let searchTimeout;
        dom.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            dom.searchClear.classList.toggle('visible', dom.searchInput.value.length > 0);
            searchTimeout = setTimeout(() => {
                state.search = dom.searchInput.value;
                applyFilters();
            }, 300);
        });

        dom.searchClear.addEventListener('click', () => {
            dom.searchInput.value = '';
            dom.searchClear.classList.remove('visible');
            state.search = '';
            applyFilters();
        });

        // Scroll indicator
        dom.scrollIndicator.addEventListener('click', () => {
            document.querySelector('.main-content').scrollIntoView({ behavior: 'smooth' });
        });

        // Filter dropdowns / inputs
        [dom.filterLocation, dom.filterFurnishing, dom.filterTransaction,
         dom.filterFacing, dom.filterOwnership, dom.filterBathroom].forEach(el => {
            el.addEventListener('change', onFilterChange);
        });

        [dom.budgetMin, dom.budgetMax, dom.areaMin, dom.areaMax].forEach(el => {
            let timeout;
            el.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(onFilterChange, 500);
            });
        });

        // Sort
        dom.sortSelect.addEventListener('change', () => {
            state.sort = dom.sortSelect.value;
            applyFilters();
        });

        // Reset filters
        dom.resetFilters.addEventListener('click', () => {
            dom.filterLocation.value = '';
            dom.filterFurnishing.value = '';
            dom.filterTransaction.value = '';
            dom.filterFacing.value = '';
            dom.filterOwnership.value = '';
            dom.filterBathroom.value = '';
            dom.budgetMin.value = '';
            dom.budgetMax.value = '';
            dom.areaMin.value = '';
            dom.areaMax.value = '';
            dom.searchInput.value = '';
            dom.searchClear.classList.remove('visible');
            state.search = '';
            state.filters.bhk = [];
            dom.bhkChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            onFilterChange();
        });

        // Toggle filters sidebar (mobile)
        dom.toggleFilters.addEventListener('click', () => {
            dom.filtersPanel.classList.toggle('visible');
        });

        // Modal
        dom.modalClose.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Selection panel
        dom.fabSelection.addEventListener('click', () => {
            dom.selectionPanel.classList.toggle('open');
        });

        dom.clearSelection.addEventListener('click', clearAllSelections);
        dom.exportSelection.addEventListener('click', exportSelectionData);

        // Close selection panel on outside click
        document.addEventListener('click', (e) => {
            if (dom.selectionPanel.classList.contains('open') &&
                !dom.selectionPanel.contains(e.target) &&
                !dom.fabSelection.contains(e.target)) {
                dom.selectionPanel.classList.remove('open');
            }
        });
    }


    // ════════════════════════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════════════════════════

    function init() {
        bindEvents();
        updateSelectionUI();
        loadData();
    }

    init();

})();
