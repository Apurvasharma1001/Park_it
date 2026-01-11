import { useState } from 'react';

const LocationAutoFill = ({ onLocationSet, currentAddress }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getCurrentLocation = () => {
    setLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get address
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          
          const address = data.display_name || `${latitude}, ${longitude}`;
          
          onLocationSet({
            address,
            latitude,
            longitude,
            coordinates: [latitude, longitude]
          });
          
          setLoading(false);
        } catch (err) {
          setError('Failed to get address. Using coordinates instead.');
          onLocationSet({
            address: `${position.coords.latitude}, ${position.coords.longitude}`,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            coordinates: [position.coords.latitude, position.coords.longitude]
          });
          setLoading(false);
        }
      },
      (err) => {
        setError('Failed to get location. Please enter address manually.');
        setLoading(false);
      }
    );
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={getCurrentLocation}
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Getting location...
          </>
        ) : (
          <>
            📍 Use Current Location
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default LocationAutoFill;

