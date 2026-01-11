const User = require('../models/User');
const Booking = require('../models/Booking');
const ParkingLot = require('../models/ParkingLot');

// @desc    Get all customers
// @route   GET /api/admin/customers
// @access  Private/Admin
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'CUSTOMER' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get all owners
// @route   GET /api/admin/owners
// @access  Private/Admin
exports.getOwners = async (req, res) => {
  try {
    const owners = await User.find({ role: 'OWNER' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: owners.length,
      data: owners,
    });
  } catch (error) {
    console.error('Get owners error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get all bookings
// @route   GET /api/admin/bookings
// @access  Private/Admin
exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer', 'name email')
      .populate('parkingLot', 'name address')
      .populate('parkingSlot', 'slotNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get all parking lots
// @route   GET /api/admin/parking-lots
// @access  Private/Admin
exports.getParkingLots = async (req, res) => {
  try {
    const parkingLots = await ParkingLot.find()
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: parkingLots.length,
      data: parkingLots,
    });
  } catch (error) {
    console.error('Get parking lots error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    const [
      totalCustomers,
      totalOwners,
      totalParkingLots,
      totalBookings,
      activeBookings,
      completedBookings,
    ] = await Promise.all([
      User.countDocuments({ role: 'CUSTOMER' }),
      User.countDocuments({ role: 'OWNER' }),
      ParkingLot.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'ACTIVE' }),
      Booking.countDocuments({ status: 'COMPLETED' }),
    ]);

    // Calculate total revenue from completed bookings
    const revenueData = await Booking.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } },
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

    res.json({
      success: true,
      data: {
        totalCustomers,
        totalOwners,
        totalParkingLots,
        totalBookings,
        activeBookings,
        completedBookings,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get single customer details
// @route   GET /api/admin/customers/:id
// @access  Private/Admin
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    
    if (!customer || customer.role !== 'CUSTOMER') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer bookings
    const bookings = await Booking.find({ customer: req.params.id })
      .populate('parkingLot', 'name address')
      .populate('parkingSlot', 'slotNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        customer,
        bookings,
      },
    });
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get single owner details
// @route   GET /api/admin/owners/:id
// @access  Private/Admin
exports.getOwnerById = async (req, res) => {
  try {
    const owner = await User.findById(req.params.id).select('-password');
    
    if (!owner || owner.role !== 'OWNER') {
      return res.status(404).json({ message: 'Owner not found' });
    }

    // Get owner parking lots
    const parkingLots = await ParkingLot.find({ owner: req.params.id })
      .sort({ createdAt: -1 });

    // Get bookings for owner's parking lots
    const parkingLotIds = parkingLots.map(lot => lot._id);
    const bookings = await Booking.find({ parkingLot: { $in: parkingLotIds } })
      .populate('customer', 'name email')
      .populate('parkingLot', 'name address')
      .populate('parkingSlot', 'slotNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        owner,
        parkingLots,
        bookings,
      },
    });
  } catch (error) {
    console.error('Get owner by ID error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

