    <script>
        let cityData = {};
        let zipData = {};
        const baseUrl = 'https://satpel.github.io/us-location-data/us_location_data/';
        const propertyDataUrl = 'https://satpel.github.io/eal-estate-data/data/';
        let currentPage = 1;
        const propertiesPerPage = 15; // 5 rows of 3 tiles

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
            document.getElementById('loading').style.display = 'none';
            document.getElementById('search-button').disabled = false;
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('loading').textContent = 'Error loading data. Please try again later.';
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
                <div class="col-sm-6 col-md-4">
                    <div class="property-card" onclick="openModal()">
                        <h3>Lease Option / Rent To Own <span class="price">${formatPrice(property.beds)}</span></h3>
                        <p class="property-location">${city}, ${state}</p>
                        <div class="property-image-container">
                            <img src="${property.imageUrl}" alt="${property.type}" class="property-image">
                        </div>
                        <div class="property-details">
                            <h5>${formatPropertyType(property.type)}</h5>
                            <p>${formatNumber(property.beds)} Beds | ${formatNumber(property.baths)} Baths | ${Number(property.squareFeet).toLocaleString()} sqft</p>
                        </div>
												<button class="btn btn-primary get-details-btn" onclick="event.stopPropagation(); openModal();">Get Details</button>
                    </div>
                </div>
            `;
        }

        async function searchProperties() {
            const input = document.getElementById('search-input').value.trim().toUpperCase();
            const grid = document.getElementById('property-grid');
            const resultsControls = document.getElementById('results-controls');
            
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

                grid.innerHTML = paginatedProperties.map(property => createPropertyCard(property, locationName)).join('');
                
                updatePagination(sortedProperties.length);

                // Show results controls after search
                resultsControls.classList.remove('hidden');
            } catch (error) {
                console.error('Error:', error);
                grid.innerHTML = "No properties found or error loading data.";
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
            const autocompleteList = document.getElementById('autocomplete-list');
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
                        document.getElementById('search-input').value = match.split(' (')[0];
                        autocompleteList.style.display = 'none';
                        searchProperties();
                    };
                    autocompleteList.appendChild(div);
                });
            }
        }

        let debounceTimer;
        document.getElementById('search-input').addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => autocomplete(this.value.toUpperCase()), 300);
        });

        document.getElementById('search-button').addEventListener('click', searchProperties);

        document.addEventListener('click', function(e) {
            if (!e.target.closest('#search-input')) {
                document.getElementById('autocomplete-list').style.display = 'none';
            }
        });

        // Modal functionality
        var modal = document.getElementById("myModal");
        var span = document.getElementsByClassName("close")[0];

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
    </script>