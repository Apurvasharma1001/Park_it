const ParkingCard = ({ parkingLot, onBook, showBookButton = true, distance }) => {
  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-gray-800">{parkingLot.name}</h3>
        {distance !== undefined && (
          <span className="text-sm font-semibold text-blue-600">
            {formatDistance(distance)}
          </span>
        )}
      </div>

      <p className="text-gray-600 mb-2">{parkingLot.address}</p>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">Price per hour</p>
          <p className="text-lg font-bold text-green-600">${parkingLot.pricePerHour}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Available slots</p>
          <p className="text-lg font-bold text-blue-600">
            {parkingLot.availableSlots || 0} / {parkingLot.totalSlots || 0}
          </p>
        </div>
      </div>

      {showBookButton && parkingLot.availableSlots > 0 && (
        <button
          onClick={() => onBook(parkingLot)}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition font-semibold"
        >
          Book Now
        </button>
      )}

      {showBookButton && parkingLot.availableSlots === 0 && (
        <button
          disabled
          className="w-full bg-gray-400 text-white py-2 rounded cursor-not-allowed font-semibold"
        >
          No Slots Available
        </button>
      )}
    </div>
  );
};

export default ParkingCard;


