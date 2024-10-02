document.addEventListener('DOMContentLoaded', function() {
    let cityData = {};
    let zipData = {};
    const baseUrl = 'https://satpel.github.io/us-location-data/us_location_data/';
    const propertyDataUrl = 'https://satpel.github.io/eal-estate-data/data/';
    let currentPage = 1;
    const propertiesPerPage = 15; // 5 rows of 3 tiles

    const container = document.getElementById('real-estate-search-embed');
    container.innerHTML = `
        <div class="search-container">
            <input type="text" id="search-input" placeholder="Enter city, state, or ZIP code">
            <button id="search-button">Search</button>
        </div>
        <div id="results-controls" class="hidden">
            <div class="sort-view-container">
                <div class="sort-container">
                    <label for="sort-select">Sort By</label>
                    <select id="sort-select" class="sort-dropdown">
                        <option value="Default">Type of Sale</option>
                        <option value="City">City</option>
                        <option value="Photos">Photos</option>
                        <option value="Price (low to high)">Price (low to high)</option>
                        <option value="Price (high to low)">Price (high to low)</option>
                        <option value="Sq. Feet (low to high)">Sq. Feet (low to high)</option>
                        <option value="Sq. Feet (high to low)">Sq. Feet (high to low)</option>
                        <option value="Most Recent">Most Recent</option>
                        <option value="Property Type">Property Type</option>
                        <option value="Status">Status</option>
                    </select>
                </div>
                <div class="view-options">
                    <button>List</button>
                    <button class="active">Tile</button>
                    <button>Map</button>
                    <button>Save Your Search</button>
                </div>
            </div>
            <div id="property-grid" class="row"></div>
            <div class="pagination"></div>
        </div>
        <div id="myModal" class="modal">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Get Access Now!</h2>
                <p>Property Details are available for REGISTERED MEMBERS ONLY.</p>
                <button>Register Now</button>
                <p class="terms-text">By clicking the button, I agree to the <a href="#">Terms and Conditions</a> and consent to receive recurring automated and prerecorded informational and marketing messages (like property alerts) at the number I provided above via email, call and text from and on behalf of RentBeforeOwning.com, Get Rent To Own, Affordable Rent to Own, National Debt Relief, Resource Match, TRA and its affiliates. I understand that consent is not required for purchase and can call (800) 553-0410 to proceed without consent.</p>
                <div class="bbb-container">
                    <img src="path_to_bbb_logo.png" alt="BBB Accredited Business" class="bbb-logo">
                    <p>Registering for our Trial Membership gives you access to our full listings, including rent to own, owner financing and more.</p>
                </div>
            </div>
        </div>
    `;

    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const autocompleteList = document.getElementById('autocomplete-list');
    const resultsControls = document.getElementById('results-controls');
    const propertyGrid = document.getElementById('property-grid');
    const modal = document.getElementById("myModal");
    const span = modal.getElementsByClassName("close")[0];

    // Load city and zip index files
    Promise.all([
        fetch(baseUrl + 'city_index.json').then(response => response.json()),
        fetch(baseUrl + 'zip_index.json').then(response => response.json())
    ])
    .then(([cityIndex, zipIndex]) => {
        return Promise.all([
            ...cityIndex.map(file => fetch(baseUrl + file).then(response => response.json())),
            ...zipIndex.map(file => fetch(baseUrl + file).then(response => response.json()))
        ]);
    })
    .then(allData => {
        allData.forEach(data => {
            if (Object.values(data)[0].hasOwnProperty('population')) {
                Object.assign(cityData, data);
            } else {
                Object.assign(zipData, data);
            }
        });
        searchButton.disabled = false;
    })
    .catch(error => {
        console.error('Error loading data:', error);
    });

    function formatPrice(bedrooms) {
        if (bedrooms == 1) return "$600";
        if (bedrooms == 2) return "$700";
        return "$900";
    }

    function formatNumber(num) {
        if (Number.isInteger(parseFloat(num))) {
            return Math.floor(num);
        }
        return parseFloat(num).toFixed(1);
    }

    function toTitleCase(str) {
        return str.split(' ').map(word => 
            word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }

    function formatPropertyType(type) {
        if (/^\d+$/.test(type) || type === 'VacantLand' || type === 'Other') {
            return 'Single Family Home';
        }
        return type.replace(/([A-Z])/g, ' $1').trim()
                   .replace(/\s*\(\s*/g, ' (')
                   .replace(/\s*\)\s*/g, ') ')
                   .replace(/(\d+)ormoreunits/, '$1 or more units')
                   .replace(/(\d+)-(\d+)units/, '$1-$2 units');
    }

    function createPropertyCard(property, location) {
        const [city, state] = location.split(', ').map(toTitleCase);
        return `
            <div class="col-sm-4">
                <div class="property-card">
                    <h3>
                        Lease Option / Rent To Own
                        <span class="price">${formatPrice(property.beds)}</span>
                    </h3>
                    <p class="property-location">${city}, ${state}</p>
                    <img src="${property.imageUrl}" alt="${property.type}" class="property-image">
                    <div class="property-details">
                        <p class="property-type">${formatPropertyType(property.type)}</p>
                        <p class="property-specs">${formatNumber(property.beds)} Beds | ${formatNumber(property.baths)} Baths | ${Number(property.squareFeet).toLocaleString()} sqft</p>
                        <button class="get-details-btn" onclick="openModal()">Get Details</button>
                    </div>
                </div>
            </div>
        `;
    }

    async function searchProperties() {
        const input = searchInput.value.trim().toUpperCase();
        let locationName = input;
        if (zipData[input]) {
            locationName = zipData[input];
        }

        try {
            const [city, state] = locationName.split(', ');
            const filename = `${state.toLowerCase()}_${city.toLowerCase().replace(/\s+/g, '_')}.json`;
            
            const response = await fetch(`${propertyDataUrl}${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const properties = await response.json();

            const sortedProperties = properties.sort((a, b) => {
                const order = { 'TownhouseOrCondo': 0, 'SingleFamilyHome': 0, 'VacantLand': 2 };
                return (order[a.type] || 1) - (order[b.type] || 1);
            });

            const startIndex = (currentPage - 1) * propertiesPerPage;
            const endIndex = startIndex + propertiesPerPage;
            const paginatedProperties = sortedProperties.slice(startIndex, endIndex);

            propertyGrid.innerHTML = paginatedProperties.map(property => createPropertyCard(property, locationName)).join('');
            
            updatePagination(sortedProperties.length);

            resultsControls.classList.remove('hidden');
        } catch (error) {
            console.error('Error:', error);
            propertyGrid.innerHTML = "No properties found or error loading data.";
            resultsControls.classList.add('hidden');
        }
    }

    function updatePagination(totalProperties) {
        const totalPages = Math.ceil(totalProperties / propertiesPerPage);
        const paginationContainer = document.querySelector('.pagination');
        let paginationHTML = `<span>Page ${currentPage} of ${totalPages}</span>`;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                paginationHTML += `<button class="active">${i}</button>`;
            } else {
                paginationHTML += `<button onclick="goToPage(${i})">${i}</button>`;
            }
        }
        
        if (currentPage < totalPages) {
            paginationHTML += `<button onclick="goToPage(${currentPage + 1})">Next »</button>`;
        }
        
        paginationContainer.innerHTML = paginationHTML;
    }

    function goToPage(page) {
        currentPage = page;
        searchProperties();
    }

    function autocomplete(input) {
        autocompleteList.innerHTML = '';
        autocompleteList.style.display = 'none';

        if (input.length < 3) return;

        const cityMatches = Object.keys(cityData)
            .filter(key => key.startsWith(input))
            .slice(0, 5);

        const zipMatches = Object.keys(zipData)
            .filter(zip => zip.startsWith(input))
            .map(zip => `${zip} (${zipData[zip]})`);

        const matches = [...cityMatches, ...zipMatches].slice(0, 5);

        if (matches.length > 0) {
            autocompleteList.style.display = 'block';
            matches.forEach(match => {
                const div = document.createElement('div');
                div.textContent = match;
                div.className = 'autocomplete-item';
                div.onclick = function() {
                    searchInput.value = match.split(' (')[0];
                    autocompleteList.style.display = 'none';
                    searchProperties();
                };
                autocompleteList.appendChild(div);
            });
        }
    }

    let debounceTimer;
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => autocomplete(this.value.toUpperCase()), 300);
    });

    searchButton.addEventListener('click', searchProperties);

    document.addEventListener('click', function(e) {
        if (!e.target.closest('#search-input')) {
            autocompleteList.style.display = 'none';
        }
    });

    function openModal() {
        modal.style.display = "block";
    }

    span.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    window.openModal = openModal;
    window.goToPage = goToPage;
});
