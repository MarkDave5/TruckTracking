const iconPaths = {
 grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 truck:'M3 6h11v12H3z M14 10h4l3 4v4h-7 M6 18v2 M18 18v2 M3 12h11',
 route:'M5 5a2 2 0 1 0 0 .1 M19 19a2 2 0 1 0 0 .1 M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8',
 camera:'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 road:'M8 3 3 21 M16 3l5 18 M12 3v3 M12 10v3 M12 17v4',
 shield:'M12 3 3 7v6c0 4 5 7 9 9 4-2 9-5 9-9V7z M12 8v5 M12 17h.01',
 sync:'M20 7a9 9 0 0 0-15-2L2 8 M2 3v5h5 M4 17a9 9 0 0 0 15 2l3-3 M22 21v-5h-5',
 battery:'M2 6h17v12H2z M22 10v4 M6 10v4 M10 10v4 M14 10v4',
 chart:'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',
 info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7h.01',
 user:'M20 21v-2a7 7 0 0 0-14 0v2 M13 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M19 5l-1.5 1.5 M6.5 17.5 5 19',
 gauge:'M4 18a9 9 0 1 1 16 0 M12 14l5-6 M7 18h10',
 pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 archive:'M3 3h18v5H3z M5 8v13h14V8 M9 12h6',
 check:'M20 6 9 17l-5-5',
 sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 1v3 M12 20v3 M1 12h3 M20 12h3 M4 4l2 2 M18 18l2 2 M20 4l-2 2 M6 18l-2 2'
};
function paintIcons() {
 document.querySelectorAll('[data-icon]').forEach(el => {
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[el.dataset.icon] || iconPaths.grid}"/></svg>`;
 });
}
function downloadReport(kind) {
 let rows;
 if (kind === 'trips') {
  rows = [['Data source','Trip','Vehicle','Driver','Date','From','To','Distance km','Duration','Efficiency km/L','Price PHP/L','Estimated fuel L','Estimated cost PHP'], ...(state.trips || []).map(t => ['Sample',t.id,t.truck,t.driver || 'Unassigned',t.date,t.from,t.to,t.distanceKm,t.duration,t.efficiencyKmPerLiter,t.pricePerLiter,(t.distanceKm/t.efficiencyKmPerLiter).toFixed(2),(t.distanceKm/t.efficiencyKmPerLiter*t.pricePerLiter).toFixed(2)])];
 } else {
  rows = [['Data source','Event','Vehicle','Date','Time','Approximate location','Confidence percent','Review status'], ...state.events.map(e => ['Sample',e.id,e.truck,e.date,e.time,e.location,e.confidence,e.status])];
 }
 const csv = rows.map(row => row.map(value => '"'+String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a'); a.href=url; a.download=`roadwatch-sample-${kind}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderStudy() {
 if(!state.demo) return;
 $('#trip-report-summary').textContent = `${state.trips.length} sample trip records`;
 $('#event-report-summary').textContent = `${state.events.length} sample detections`;
 $('#export-trips').disabled = false; $('#export-events').disabled = false;
}
function initializeStudy() {
 paintIcons();
 $('#export-trips').addEventListener('click',()=>downloadReport('trips'));
 $('#export-events').addEventListener('click',()=>downloadReport('events'));
}
