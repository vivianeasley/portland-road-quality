import { useEffect, useRef, useState } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css'
import { layerGroup as leafletLayerGroup, tileLayer, map as leafletMap, polyline, Map, LayerGroup } from 'leaflet';
import type { FeatureCollection, MultiLineString, LineString } from 'geojson';
import { partOne } from './data/partOne';
import { partTwo } from './data/partTwo';


// get user location and add center map button
// fix iOS issue

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
  isGravel?: 'N' | 'Y';
  LastInspectionDate?: string
}

function getColor(pci: number | 'N/A', isGravel: boolean): string {
  if (isGravel) return "#000"
  if (typeof pci === 'string' || undefined) return '#808080'; // no data
  if (pci >= 86) return '#1a9641'; // Good
  if (pci >= 71) return '#52b151'; // Satisfactory
  if (pci >= 56) return '#a6d96a'; // Fair
  if (pci >= 41) return '#fdae61'; // Poor
  if (pci >= 26) return '#e8622a'; // Very Poor
  if (pci >= 11) return '#d7191c'; // Serious
  return '#7b0000';                // Failed
}

function getWeight(inspectionYear: number | null): number {
  if (!inspectionYear) return 1
  if (inspectionYear >= 2020) return 5; // Good
  return 2;                // Failed
}

function App() {
  const mapRef = useRef<Map | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState('Adjust the slider to filter street segments.');
  const [error, setError] = useState('');
  const [yearOut, setYearOut] = useState(1970);
  const [mapReady, setMapReady] = useState(false);

  const onCenterMap = () => {
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    function success(pos) {
      const crd = pos.coords;
      if (mapRef.current) {
        mapRef.current.setView([crd.latitude, crd.longitude], 17);
      }
      console.log("Your current position is:");
      console.log(`Latitude : ${crd.latitude}`);
      console.log(`Longitude: ${crd.longitude}`);
      console.log(`More or less ${crd.accuracy} meters.`);
    }

    function error(err) {
      console.warn(`ERROR(${err.code}): ${err.message}`);
    }

    navigator.geolocation.getCurrentPosition(success, error, options);    
  }

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
    console.log(lastGeoJSON.features[50])
    lastGeoJSON.features.forEach((f) => {
      if (!f.geometry?.coordinates) return;

      const props = f.properties as PavementProperties;
      const rawMaintenanceDate = props.RehabDate ?? props.MaintenanceDate;
      const rawInspectionDate = props.LastInspectionDate
      let year: number | null = null;
      let inspectionYear: number | null = null;

      if (rawMaintenanceDate) {
        const d = new Date(rawMaintenanceDate);
        if (!isNaN(d.getTime())) year = d.getFullYear();
      }
      if (rawInspectionDate) {
        const d = new Date(rawInspectionDate);
        if (!isNaN(d.getTime())) inspectionYear = d.getFullYear();
      }
 
      const weight = getWeight(inspectionYear)

      const coordSets =
        f.geometry.type === 'MultiLineString'
          ? f.geometry.coordinates.map((seg) => seg.map(([lng, lat]) => [lat, lng] as [number, number]))
          : [f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])];

      coordSets.forEach((seg) => {
        if (seg.length < 2) return;
        const pci = props.PCI != null ? Math.round(props.PCI) : 'N/A';
        const isGravel = props.isGravel != null && props.isGravel === 'Y' ? true : false;
        const color = getColor(pci, isGravel);
        const pl = polyline(seg, { color, weight, opacity: 0.85 });
        const name = props.Streetname ?? 'Unknown street';

        pl.bindPopup(`<strong>${name}</strong><br>Repaved: ${year ?? 'Unknown'}<br>Inspected: ${inspectionYear ?? 'Unknown'}<br>Condition (1-100): ${pci}`);
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
      <div id="app">
        <div id="toolbar">
          <div className="ctrl-group">
            <label htmlFor="yearSlider">Repaved:</label>
            <input
              id="yearSlider"
              type="range"
              min="1970"
              max="2025"
              value={yearOut}
              step="1"
              onChange={(e) => setYearOut(Number(e.target.value))}
            />
            <span id="yearOut">{yearOut}</span>
            <button onClick={onCenterMap}>Center</button>
          </div>
          {error && <div id="error-box">{error}</div>}
        </div>

        <div id="map-wrap">
          <div id="map" ref={mapContainerRef} />
          <div id="status-bar">{status}</div>
          <div id="legend">
              <details>
                <summary>Road Quality Key</summary>
                  <br/>
                  <div>Quality: Color</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#1a9641' }} />Good</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#52b151' }} />Satisfactory</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#a6d96a' }} />Fair</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#fdae61' }} />Poor</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#e8622a' }} />Very Poor</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#d7191c' }} />Serious</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#7b0000' }} />Terrible+</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#000' }} />Gravel</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#808080' }} />No Data</div>
                  <div>Inspection date: Width</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#808080', height: '5px' }} />After 2020</div>
                  <div className="leg"><div className="leg-line" style={{ background: '#808080', height: '2px' }} />Before 2020</div>
              </details>
            <h3></h3>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;