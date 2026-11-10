let destinationSuggestionTimer = null;
let destinationSuggestionRequest = null;
let destinationSuggestionResults = [];

function clearDestinationSuggestions() {
  clearTimeout(destinationSuggestionTimer);
  if (destinationSuggestionRequest) destinationSuggestionRequest.abort();
  destinationSuggestionRequest = null;
  destinationSuggestionResults = [];
  $('#destination-suggestions').hidden = true;
  $('#destination-suggestions').innerHTML = '';
  $('#destination-suggestion-message').textContent = '';
}

function suggestDestination() {
  clearDestinationSuggestions();
  // A changed name must not silently retain coordinates for an earlier place.
  if (assignmentPoint) {
    assignmentPoint = null;
    showAssignmentPoint();
    $('#assignment-message').textContent = 'Destination changed. Select a suggestion or choose a new map location.';
  }
  const query = $('#assignment-destination').value.trim();
  if (query.length < 3) return;
  $('#destination-suggestion-message').textContent = 'Looking for places using Photon…';
  destinationSuggestionTimer = setTimeout(() => fetchDestinationSuggestions(query), 900);
}

async function fetchDestinationSuggestions(query) {
  const controller = new AbortController();
  destinationSuggestionRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const url = new URL(placeSearchEndpoint);
    url.search = new URLSearchParams({q:query, limit:'5', lat:'14.5995', lon:'120.9842'}).toString();
    const response = await fetch(url, {signal:controller.signal, credentials:'omit'});
    if (!response.ok) throw new Error('Search unavailable');
    const data = await response.json();
    if (destinationSuggestionRequest !== controller || $('#assignment-destination').value.trim() !== query) return;
    destinationSuggestionResults = parsePlaceFeatures(data);
    const list = $('#destination-suggestions');
    list.innerHTML = destinationSuggestionResults.map((place, index) => `<button type="button" data-destination-index="${index}">${escapeHtml(place.label)}</button>`).join('');
    list.hidden = !destinationSuggestionResults.length;
    $('#destination-suggestion-message').textContent = destinationSuggestionResults.length ? 'Select a suggestion to place it on the map.' : 'No suggestions found. You can enter the destination manually.';
  } catch (error) {
    if (destinationSuggestionRequest === controller) $('#destination-suggestion-message').textContent = 'Suggestions unavailable. You can enter the destination manually.';
  } finally {
    clearTimeout(timeout);
    if (destinationSuggestionRequest === controller) destinationSuggestionRequest = null;
  }
}

function chooseDestinationSuggestion(index) {
  const place = destinationSuggestionResults[index];
  if (!place) return;
  $('#assignment-destination').value = place.label.slice(0, 160);
  assignmentPoint = {lat:place.lat, lng:place.lng};
  pickingDestination = false;
  clearDestinationSuggestions();
  showAssignmentPoint();
  if (overviewMap) overviewMap.setView([place.lat, place.lng], 15);
  if (typeof centerGoogleMap === 'function') centerGoogleMap(place.lat, place.lng, 15);
  $('#assignment-message').textContent = 'Destination selected. Save the assignment to keep it.';
}
