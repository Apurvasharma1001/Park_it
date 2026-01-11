import { useState } from 'react';

const LocationInput = ({ onLocationChange, initialAddress = '', showMap = true, MapComponent = null, requireSave = false }) => {
  const [locationMode, setLocationMode] = useState('current'); // 'current' or 'manual'
  const [address, setAddress] = useState(initialAddress);
  const [coordinates, setCoordinates] = useState(null);
  const [tempLocation, setTempLocation] = useState(null); // Temporary location before saving
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Get current location
  const getCurrentLocation = () => {
    setLoading(true);
    setError('');
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setCoordinates(coords);
        setLoading(false);
        
        // Reverse geocode to get address
        const geocodedAddress = await reverseGeocode(coords[0], coords[1]);
        const locationData = {
          coordinates: coords,
          address: geocodedAddress || address || 'Current Location',
          mode: 'current'
        };
        
        if (requireSave) {
          // Store temporarily, don't save yet
          setTempLocation(locationData);
        } else {
          // Auto-save immediately
          if (onLocationChange) {
            onLocationChange(locationData);
          }
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        setError('Unable to get your location. Please try again or enter an address manually.');
        setLoading(false);
      }
    );
  };

  // Geocode address to coordinates
  const geocodeAddress = async (addressToGeocode) => {
    if (!addressToGeocode || addressToGeocode.trim() === '') {
      setError('Please enter an address');
      return;
    }

    setGeocoding(true);
    setError('');

    try {
      // Using OpenStreetMap Nominatim API (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressToGeocode)}&limit=1`,
        {
          headers: {
            'User-Agent': 'Parkit-App' // Required by Nominatim
          }
        }
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const coords = [parseFloat(result.lat), parseFloat(result.lon)];
        setCoordinates(coords);
        setGeocoding(false);
        
        const locationData = {
          coordinates: coords,
          address: result.display_name || addressToGeocode,
          mode: 'manual'
        };
        
        if (requireSave) {
          // Store temporarily, don't save yet
          setTempLocation(locationData);
        } else {
          // Auto-save immediately
          if (onLocationChange) {
            onLocationChange(locationData);
          }
        }
      } else {
        setError('Address not found. Please try a more specific address.');
        setGeocoding(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setError('Failed to find location. Please check your internet connection and try again.');
      setGeocoding(false);
    }
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'User-Agent': 'Parkit-App'
          }
        }
      );

      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
        return data.display_name;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  // Save the location (called when save button is clicked)
  const handleSaveLocation = () => {
    if (tempLocation && onLocationChange) {
      onLocationChange(tempLocation);
      setTempLocation(null); // Clear temp location after saving
    }
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    geocodeAddress(address);
  };

  const handleModeChange = (mode) => {
    setLocationMode(mode);
    setError('');
    setCoordinates(null);
    setTempLocation(null); // Clear temp location when switching modes
    
    if (mode === 'current') {
      getCurrentLocation();
    }
  };

  return (
    <div className="space-y-4">
      {/* Location Mode Selection */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => handleModeChange('current')}
          className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
            locationMode === 'current'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
          }`}
        >
          📍 Use Current Location
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('manual')}
          className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
            locationMode === 'manual'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
          }`}
        >
          📝 Enter Address
        </button>
      </div>

      {/* Current Location Mode */}
      {locationMode === 'current' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Getting location...' : '📍 Get My Current Location'}
          </button>
          {coordinates && (
            <div className="space-y-2">
              <p className="text-sm text-green-600">
                ✓ Location found: {address || `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`}
              </p>
              {requireSave && tempLocation && (
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-semibold"
                >
                  💾 Save Location
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual Address Input Mode */}
      {locationMode === 'manual' && (
        <div className="space-y-2">
          <form onSubmit={handleAddressSubmit} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address (e.g., 123 Main St, New York, NY)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                disabled={geocoding}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {geocoding ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              💡 Enter a full address for best results (e.g., street, city, state)
            </p>
          </form>
          {coordinates && tempLocation && requireSave && (
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <p className="text-sm text-green-600">
                ✓ Location found: {tempLocation.address || `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`}
              </p>
              <button
                type="button"
                onClick={handleSaveLocation}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-semibold"
              >
                💾 Save Location
              </button>
            </div>
          )}
          {coordinates && !requireSave && (
            <p className="text-sm text-green-600">
              ✓ Location set: {address || `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`}
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Map Display (if provided) */}
      {showMap && MapComponent && coordinates && (
        <div className="mt-4">
          {MapComponent}
        </div>
      )}
    </div>
  );
};

export default LocationInput;

