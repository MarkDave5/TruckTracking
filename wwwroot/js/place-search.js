// Prototype place search using the Photon demo service.
const placeSearchEndpoint = 'https://photon.komoot.io/api/';
let placeSearchResults = [];
let placeSearchMarker = null;
let activePlaceSearch = null;
let placeSearchTimer = null;

function parsePlaceFeatures(data) {
  return (Array.isArray(data.features) ? data.features : []).flatMap(feature => {
    const coordinates = feature?.geometry?.coordinates, p = feature?.properties || {};
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates) || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return [];
    const parts = [p.name, p.street, p.city || p.district, p.state, p.country].filter(v => typeof v === 'string' && v.trim());
    const label = [...new Set(parts)].join(', ');
    return label ? [{label, lat:coordinates[1], lng:coordinates[0]}] : [];
  });
}

function suggestPlaces() {
  clearTimeout(placeSearchTimer);
  if (activePlaceSearch) { activePlaceSearch.abort(); activePlaceSearch = null; }
  $('#place-search-button').disabled = false;
  placeSearchResults = [];
  $('#place-search-results').innerHTML = '';
  const query = $('#place-search-input').value.trim();
  if (query.length < 3) {
    $('#place-search-message').textContent = query ? 'Type at least 3 characters for suggestions.' : '';
    return;
  }
  $('#place-search-message').textContent = 'Looking for suggestions…';
  placeSearchTimer = setTimeout(() => searchPlaces(), 900);
}

async function searchPlaces(event) {
  if (event) event.preventDefault();
  clearTimeout(placeSearchTimer);
  const query = $('#place-search-input').value.trim();
  const message = $('#place-search-message'), results = $('#place-search-results');
  if (!query) { message.textContent = 'Enter a place to search.'; return; }
  if (activePlaceSearch) activePlaceSearch.abort();
  const controller = new AbortController(); activePlaceSearch = controller;
  const timeout = setTimeout(() => controller.abort(), 12000);
  const button = $('#place-search-button'); button.disabled = true;
  results.innerHTML = ''; placeSearchResults = []; message.textContent = 'Searching for places…';
  try {
    const url = new URL(placeSearchEndpoint);
    url.search = new URLSearchParams({q:query, limit:'5', lat:'14.5995', lon:'120.9842'}).toString();
    const response = await fetch(url, {signal:controller.signal, credentials:'omit'});
    if (!response.ok) throw new Error('Search is unavailable. Check your internet connection and try again.');
    const data = await response.json();
    if (activePlaceSearch !== controller) return;
    placeSearchResults = parsePlaceFeatures(data);
    message.textContent = placeSearchResults.length ? 'Suggestions: choose a place to view it or use it as a destination.' : 'No places found. Try a more specific name or address.';
    results.innerHTML = placeSearchResults.map((place, index) => `<div class="place-search-result"><strong>${escapeHtml(place.label)}</strong><div class="place-search-result-actions"><button type="button" class="button button-outline" data-place-index="${index}" data-place-action="view">View on map</button><button type="button" class="button button-outline" data-place-index="${index}" data-place-action="use">Use destination</button></div></div>`).join('');
  } catch (error) {
    if (activePlaceSearch === controller) message.textContent = error.name === 'AbortError' ? 'Search timed out. Please try again.' : 'Search is unavailable. Check your internet connection and try again.';
  } finally {
    clearTimeout(timeout);
    if (activePlaceSearch === controller) { activePlaceSearch = null; button.disabled = false; }
  }
}

function choosePlace(index, action) {
  const place = placeSearchResults[index];
  if (!place || !['view', 'use'].includes(action)) return;
  if ((!overviewMap || !window.L) && !(typeof googleMapActive !== 'undefined' && googleMapActive)) { $('#place-search-message').textContent = 'Map unavailable. Check your internet connection and reload the page.'; return; }
  if (action === 'use' && !$('#assignment-truck').value) { $('#assignment-panel').open = true; $('#place-search-message').textContent = 'Select a truck in Assign a destination first, then choose Use destination.'; return; }
  if (placeSearchMarker) { overviewMap.removeLayer(placeSearchMarker); placeSearchMarker = null; }
  if (overviewMap) overviewMap.setView([place.lat, place.lng], 15);
  if (typeof centerGoogleMap === 'function') centerGoogleMap(place.lat, place.lng, 15);
  if (action === 'use') {
    if (typeof showGoogleSearchPoint === 'function') showGoogleSearchPoint(null);
    $('#assignment-panel').open = true;
    pickingDestination = false;
    assignmentPoint = {lat:place.lat, lng:place.lng};
    $('#assignment-destination').value = place.label.slice(0, 160);
    showAssignmentPoint();
    $('#assignment-message').textContent = 'Destination selected. Choose a truck and save the assignment.';
    $('#place-search-message').textContent = document.fullscreenElement ? 'Destination added. Exit full screen, then save the assignment.' : 'Destination added. Save the assignment to keep it.';
  } else {
    if (overviewMap && window.L) placeSearchMarker = L.circleMarker([place.lat, place.lng], {radius:10, color:'#fff', weight:3, fillColor:'#7157b8', fillOpacity:1}).addTo(overviewMap).bindPopup(`<strong>Search result</strong><br>${escapeHtml(place.label)}`).openPopup();
    if (typeof showGoogleSearchPoint === 'function') showGoogleSearchPoint(place);
    $('#place-search-message').textContent = 'Showing the search result on the map.';
  }
}
