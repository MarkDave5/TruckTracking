function render() {
  $('#nav-trucks').textContent = state.trucks.length;
  renderDrivers();
  renderOverview();
  renderAssignments();
  renderCameraFleet();
  renderRoadReviews();
  renderTrips();
  renderVehicles();
}
