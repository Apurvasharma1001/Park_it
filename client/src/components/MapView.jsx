import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons - Defined outside component to prevent recreation on re-render
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const parkingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to handle map updates and resizing
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();

  // Handle invalidation for dynamic containers
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
};

// Component to handle map clicks
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick(e);
      }
    },
  });
  return null;
};

const MapView = ({ userLocation, parkingLots, onParkingLotClick, onMapClick, height = '400px' }) => {
  const mapRef = useRef(null);

  const defaultCenter = userLocation || [40.7128, -74.0060]; // Default to NYC
  const defaultZoom = userLocation ? 13 : 10;

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-100 relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater center={userLocation} zoom={13} />
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Popup>Your Location/Pin</Popup>
          </Marker>
        )}

        {parkingLots?.map((lot) => {
          const coords = lot.location?.coordinates;
          if (!coords || coords.length !== 2) return null;

          return (
            <Marker
              key={lot._id}
              position={[coords[1], coords[0]]}
              icon={parkingIcon}
              eventHandlers={{
                click: () => onParkingLotClick && onParkingLotClick(lot),
              }}
            >
              <Popup>
                <div>
                  <h3 className="font-bold">{lot.name}</h3>
                  <p className="text-sm">{lot.address}</p>
                  <p className="text-sm text-green-600 font-semibold">
                    ${lot.pricePerHour}/hr
                  </p>
                  <p className="text-sm">
                    Available: {lot.availableSlots || 0} / {lot.totalSlots || 0}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;

