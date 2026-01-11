import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { parkingLotAPI } from '../services/api';
import MapView from '../components/MapView';
import LiveCameraSlotSelector from '../components/LiveCameraSlotSelector';
import LiveOccupancyTracker from '../components/LiveOccupancyTracker';
import LocationAutoFill from '../components/LocationAutoFill';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, MapPin, DollarSign, Car, Camera, Trash2, Check, AlertCircle } from 'lucide-react';

const OwnerDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [parkingLots, setParkingLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '', // Keeping as string/number based on existing logic
    pricePerHour: '',
    useOpenCV: false,
    totalSlots: '',
    cameraSlots: null,
  });
  const [locationData, setLocationData] = useState(null);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showOccupancyTracker, setShowOccupancyTracker] = useState(false);
  const [selectedLotForTracking, setSelectedLotForTracking] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'OWNER') {
      navigate('/login');
      return;
    }
    fetchParkingLots();
  }, [isAuthenticated, user, navigate]);

  const fetchParkingLots = async () => {
    try {
      setLoading(true);
      const response = await parkingLotAPI.getOwnerLots();
      setParkingLots(response.data);
    } catch (error) {
      console.error('Error fetching parking lots:', error);
      setError('Failed to load parking lots');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    if (name === 'useOpenCV') {
      setFormData(prev => ({
        ...prev,
        useOpenCV: checked,
        totalSlots: '',
        cameraSlots: null,
      }));
    }
  };

  /* New State for Map Loading */
  const [mapLoading, setMapLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ... (existing handleChange) ...

  const handleLocationSet = (location) => {
    setLocationData(location);
    setFormData({
      ...formData,
      address: location.address || formData.address,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
    });
    setError('');
    // setSuccess('Location set successfully!'); // Removed to reduce noise
  };

  const handleMapClick = async (e) => {
    const { lat, lng } = e.latlng;
    setMapLoading(true);

    // Immediate feedback with coordinates while fetching address
    handleLocationSet({
      address: 'Fetching address...',
      latitude: lat,
      longitude: lng,
      coordinates: [lat, lng]
    });

    try {
      // Reverse geocode
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      handleLocationSet({
        address,
        latitude: lat,
        longitude: lng,
        coordinates: [lat, lng]
      });
      setSuccess('Location pinned!');
      setTimeout(() => setSuccess(''), 2000);

    } catch (err) {
      console.error("Map click reverse geocode error", err);
      // Fallback
      handleLocationSet({
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        latitude: lat,
        longitude: lng,
        coordinates: [lat, lng]
      });
    } finally {
      setMapLoading(false);
    }
  };

  const handleCameraSlotsSelected = (slotData) => {
    setFormData({
      ...formData,
      cameraSlots: slotData,
      totalSlots: slotData.totalSlots.toString(),
    });
    setShowCameraSelector(false);
    setSuccess(`Selected ${slotData.totalSlots} parking slots!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name || !formData.address || !formData.latitude || !formData.longitude || !formData.pricePerHour) {
      setError('Please fill all required fields');
      return;
    }

    if (!locationData) {
      setError('Please set the location');
      return;
    }

    if (formData.useOpenCV) {
      if (!formData.cameraSlots || formData.cameraSlots.slots.length === 0) {
        setError('Please select parking slots using camera');
        return;
      }
    } else {
      if (!formData.totalSlots || parseInt(formData.totalSlots) < 1) {
        setError('Please enter number of parking slots');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const createData = {
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        pricePerHour: parseFloat(formData.pricePerHour),
        totalSlots: parseInt(formData.totalSlots),
      };

      const response = await parkingLotAPI.create(createData);
      const parkingLotId = response.data._id || response.data.id;

      if (formData.useOpenCV && formData.cameraSlots) {
        try {
          const lotResponse = await parkingLotAPI.getById(parkingLotId);
          const createdSlots = lotResponse.data.slots || [];

          const slotDefinitions = formData.cameraSlots.slots.map(slotDef => {
            const slot = createdSlots.find(s => s.slotNumber === slotDef.slot_number);
            return slot ? {
              slot_id: slot._id,
              slot_number: slotDef.slot_number,
              coordinates: slotDef.coordinates,
              image_width: slotDef.imageWidth,
              image_height: slotDef.imageHeight,
            } : null;
          }).filter(s => s !== null);

          if (slotDefinitions.length > 0) {
            await parkingLotAPI.defineSlots(parkingLotId, {
              slots: slotDefinitions,
            });
          }
        } catch (cvError) {
          console.error('OpenCV slot definition error:', cvError);
        }
      }

      setSuccess('Parking lot added successfully!');
      resetForm();
      setShowAddForm(false);
      await fetchParkingLots();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add parking lot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      pricePerHour: '',
      useOpenCV: false,
      totalSlots: '',
      cameraSlots: null,
    });
    setLocationData(null);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    resetForm();
    setShowAddForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this parking lot?')) return;
    try {
      await parkingLotAPI.delete(id);
      setSuccess('Parking lot deleted successfully!');
      fetchParkingLots();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete parking lot');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Owner Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage your parking lots and track occupancy</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all font-medium"
          >
            {showAddForm ? <X className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            {showAddForm ? 'Cancel' : 'Add Parking Lot'}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center"
            >
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center"
            >
              <Check className="w-5 h-5 mr-2" />
              {success}
            </motion.div>
          )}

          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 mb-8 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                <h2 className="text-2xl font-bold text-slate-800">Add New Parking Lot</h2>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="parking-lot-form"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      'Save & Publish'
                    )}
                  </button>
                </div>
              </div>

              <form id="parking-lot-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Parking Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="e.g., Central Plaza Parking"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hourly Rate (₹)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="pricePerHour"
                        value={formData.pricePerHour}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                        placeholder="50.00"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="useOpenCV"
                        name="useOpenCV"
                        checked={formData.useOpenCV}
                        onChange={handleChange}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="useOpenCV" className="font-semibold text-slate-800 cursor-pointer">
                        Enable Smart Camera Detection
                      </label>
                    </div>

                    {formData.useOpenCV ? (
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                          Use your webcam or CCTV to automatically detect available slots.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowCameraSelector(true)}
                          className="w-full flex items-center justify-center px-4 py-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition font-medium"
                        >
                          <Camera className="w-5 h-5 mr-2" />
                          Configure Camera Slots
                        </button>
                        {formData.cameraSlots && (
                          <div className="flex items-center text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm">
                            <Check className="w-4 h-4 mr-2" />
                            {formData.cameraSlots.totalSlots} slots configured
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Total Capacity</label>
                        <input
                          type="number"
                          min="1"
                          name="totalSlots"
                          value={formData.totalSlots}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="Number of slots"
                          required={!formData.useOpenCV}
                        />
                        <p className="text-xs text-slate-500">Manual capacity management</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Location & Address</label>
                    <div className="space-y-3">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPin className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                          placeholder="Search or enter address"
                          required
                        />
                      </div>

                      <div className="bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <LocationAutoFill
                          onLocationSet={handleLocationSet}
                          currentAddress={formData.address}
                        />
                      </div>

                      {locationData && (
                        <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3">
                          <div className="bg-green-100 p-1.5 rounded-full mt-0.5">
                            <Check className="w-4 h-4 text-green-700" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-800">Location Verified</p>
                            <p className="text-xs text-green-700 mt-1">{locationData.address}</p>
                            <p className="text-xs text-green-600 mt-0.5 font-mono">
                              {formData.latitude?.toString().substring(0, 8)}, {formData.longitude?.toString().substring(0, 8)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Pin on Map</label>
                        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
                          <MapView
                            userLocation={
                              formData.latitude && formData.longitude
                                ? [parseFloat(formData.latitude), parseFloat(formData.longitude)]
                                : null
                            }
                            parkingLots={[]} // No other lots shown while adding
                            onMapClick={handleMapClick}
                            height="300px"
                          />
                          {mapLoading && (
                            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-[500]">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Click on the map to set the exact location.</p>
                      </div>

                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {parkingLots.length === 0 ? (
              <div className="col-span-2 flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Car className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">No Parking Lots Yet</h3>
                <p className="text-slate-500 mt-2 mb-6">Create your first parking lot to start managing.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition font-medium"
                >
                  Create Parking Lot
                </button>
              </div>
            ) : (
              parkingLots.map((lot) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={lot._id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{lot.name}</h3>
                        <div className="flex items-center text-slate-500 text-sm">
                          <MapPin className="w-4 h-4 mr-1" />
                          {lot.address}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(lot._id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Parking Lot"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Rate</p>
                        <p className="text-xl font-bold text-slate-900">₹{lot.pricePerHour}<span className="text-sm text-slate-500 font-normal">/hr</span></p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${lot.availableSlots > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <p className="text-lg font-bold text-slate-900">
                            {lot.availableSlots} <span className="text-sm text-slate-500 font-normal">free</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {lot.slots && lot.slots.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                          <p className="text-sm font-bold text-slate-700">Live Status</p>
                          {(lot.cameraEnabled || (lot.slots && lot.slots.some(s => s.coordinates && s.coordinates.length > 0))) && (
                            <button
                              onClick={() => {
                                setSelectedLotForTracking(lot);
                                setShowOccupancyTracker(true);
                              }}
                              className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50 transition shadow-sm flex items-center"
                            >
                              <Camera className="w-3 h-3 mr-1.5" />
                              Live View
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                          {lot.slots.map((slot) => (
                            <div
                              key={slot._id}
                              className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all ${slot.isOccupied
                                ? 'bg-red-100 border-2 border-red-200 text-red-700 shadow-sm'
                                : 'bg-white border-2 border-green-200 text-green-700 shadow-sm'
                                }`}
                              title={`Slot ${slot.slotNumber}: ${slot.isOccupied ? 'Occupied' : 'Free'}`}
                            >
                              <div className="text-sm mb-0.5">{slot.isOccupied ? '🚗' : '✨'}</div>
                              <div className="font-bold text-xs">#{slot.slotNumber}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </AnimatePresence>
      </div>

      {showCameraSelector && (
        <LiveCameraSlotSelector
          onSlotsSelected={handleCameraSlotsSelected}
          onClose={() => setShowCameraSelector(false)}
        />
      )}

      {showOccupancyTracker && selectedLotForTracking && (
        <LiveOccupancyTracker
          parkingLotId={selectedLotForTracking._id}
          slots={(selectedLotForTracking.slots || []).map(slot => ({
            slot_number: slot.slotNumber,
            coordinates: slot.coordinates || [],
            imageWidth: slot.imageWidth,
            imageHeight: slot.imageHeight,
            _id: slot._id,
          }))}
          onClose={() => {
            setShowOccupancyTracker(false);
            setSelectedLotForTracking(null);
          }}
        />
      )}
    </div>
  );
};

export default OwnerDashboard;
