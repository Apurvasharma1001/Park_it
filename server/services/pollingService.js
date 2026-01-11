const ParkingLot = require('../models/ParkingLot');
const slotAvailabilityService = require('./slotAvailabilityService');

const POLLING_INTERVAL_MS = 10000; // 10 seconds

class PollingService {
    constructor() {
        this.intervalId = null;
        this.isPolling = false;
    }

    start() {
        if (this.intervalId) return;

        console.log('📷 Starting Camera Polling Service...');
        this.poll(); // Initial poll

        this.intervalId = setInterval(() => {
            this.poll();
        }, POLLING_INTERVAL_MS);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('📷 Camera Polling Service stopped');
        }
    }

    async poll() {
        if (this.isPolling) return; // Skip if previous poll hasn't finished
        this.isPolling = true;

        try {
            // Find all parking lots with camera enabled
            const parkingLots = await ParkingLot.find({
                isActive: true,
                cameraEnabled: true
            });

            if (parkingLots.length === 0) {
                this.isPolling = false;
                return;
            }

            // Process concurrently but limit simple Promise.all
            // For now, simpler is fine as we expect few lots in demo
            const results = await Promise.allSettled(
                parkingLots.map(lot =>
                    slotAvailabilityService.refreshSlotStatus(lot._id)
                        .then(() => ({ id: lot._id, status: 'success' }))
                        .catch(err => ({ id: lot._id, status: 'failed', error: err.message }))
                )
            );

            // Optional logging for debugging
            // const successCount = results.filter(r => r.status === 'fulfilled').length;
            // if (successCount > 0) console.log(`📷 Polled ${successCount}/${parkingLots.length} cameras successfully`);

        } catch (error) {
            console.error('Polling service error:', error.message);
        } finally {
            this.isPolling = false;
        }
    }
}

module.exports = new PollingService();
