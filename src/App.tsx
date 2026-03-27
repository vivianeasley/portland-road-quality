import { useEffect, useRef, useState } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css'
import { layerGroup as leafletLayerGroup, tileLayer, map as leafletMap, polyline, Map, LayerGroup } from 'leaflet';
import type { FeatureCollection, MultiLineString, LineString } from 'geojson';
import { partOne } from './data/partOne';
import { partTwo } from './data/partTwo';


const lastGeoJSON = {
"type": "FeatureCollection",
"name": "Pavement_Management_System",
"crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
"features": [...partOne, ...partTwo]
} as FeatureCollection<MultiLineString | LineString>;

interface PavementProperties {
  RehabDate?: string;
  MaintenanceDate?: string;
  Streetname?: string;
  PCI?: number;
}

function getColor(pci: number | 'N/A'): string {
  if (typeof pci === 'string') return '#808080'; // no data
  if (pci >= 86) return '#1a9641'; // Good
  if (pci >= 71) return '#52b151'; // Satisfactory
  if (pci >= 56) return '#a6d96a'; // Fair
  if (pci >= 41) return '#fdae61'; // Poor
  if (pci >= 26) return '#e8622a'; // Very Poor
  if (pci >= 11) return '#d7191c'; // Serious
  return '#7b0000';                // Failed
}

function App() {
  const mapRef = useRef<Map | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState('Adjust the slider to filter street segments.');
  const [error, setError] = useState('');
  const [yearOut, setYearOut] = useState(1980);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = leafletMap(mapContainerRef.current).setView([45.5231, -122.6765], 12);
    mapRef.current = map;

    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: City of Portland PBOT',
      maxZoom: 19,
    }).addTo(map);

    layerGroupRef.current = leafletLayerGroup().addTo(map);
    setMapReady(true)

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Re-render street segments whenever yearOut changes
useEffect(() => {
  if (!mapReady || !layerGroupRef.current) return;

  setError('');
  layerGroupRef.current.clearLayers();

  try {
    let count = 0;

    lastGeoJSON.features.forEach((f) => {
      if (!f.geometry?.coordinates) return;

      const props = f.properties as PavementProperties;
      const rawDate = props.RehabDate ?? props.MaintenanceDate;
      let year: number | null = null;

      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) year = d.getFullYear();
      }

      if (!year || year < yearOut) return;

      const coordSets =
        f.geometry.type === 'MultiLineString'
          ? f.geometry.coordinates.map((seg) => seg.map(([lng, lat]) => [lat, lng] as [number, number]))
          : [f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])];


      const weight = 3.5 // getWeight(year) can be used for weight

      coordSets.forEach((seg) => {
        if (seg.length < 2) return;
        const pci = props.PCI != null ? Math.round(props.PCI) : 'N/A';
        const color = getColor(pci);
        const pl = polyline(seg, { color, weight, opacity: 0.85 });
        const name = props.Streetname ?? 'Unknown street';

        const dateStr = rawDate
          ? new Date(rawDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          : 'Unknown';

        pl.bindPopup(`<strong>${name}</strong><br>Repaved: ${dateStr}<br>Condition index (PCI): ${pci}`);
        layerGroupRef.current!.addLayer(pl);
        count++;
      });
    });

    setStatus(`Showing ${count.toLocaleString()} street segments repaved since ${yearOut}.`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setError(`Could not load data: ${msg}`);
    setStatus('');
  }
}, [yearOut, mapReady]);

  return (
    <>
      <header>
        <h1>Portland Street Repaving Map</h1>
        <p>Data sourced from Portland Bureau of Transportation (PBOT) open data</p>
      </header>

      <div id="app">
        <div id="toolbar">
          <div className="ctrl-group">
            <label htmlFor="yearSlider">Repaved since:</label>
            <input
              id="yearSlider"
              type="range"
              min="1980"
              max="2025"
              value={yearOut}
              step="1"
              onChange={(e) => setYearOut(Number(e.target.value))}
            />
            <span id="yearOut">{yearOut}</span>
          </div>
          {error && <div id="error-box">{error}</div>}
        </div>

        <div id="map-wrap">
          <div id="map" ref={mapContainerRef} />
          <div id="status-bar">{status}</div>
          <div id="legend">
            <h3>Last repaved</h3>
            <div className="leg"><div className="leg-line" style={{ background: '#1a9641' }} />2022–2025</div>
            <div className="leg"><div className="leg-line" style={{ background: '#a6d96a' }} />2018–2021</div>
            <div className="leg"><div className="leg-line" style={{ background: '#fdae61' }} />2014–2017</div>
            <div className="leg"><div className="leg-line" style={{ background: '#d7191c' }} />Before 2014</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;