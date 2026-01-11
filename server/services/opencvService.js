/**
 * OpenCV Service Client
 * 
 * Communicates with the Python OpenCV service for parking occupancy detection
 */
const axios = require('axios');

const OPENCV_SERVICE_URL = process.env.OPENCV_SERVICE_URL || 'http://localhost:5001';

class OpenCVService {
  /**
   * Check if OpenCV service is available
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${OPENCV_SERVICE_URL}/health`, {
        timeout: 5000,
      });
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('OpenCV service health check failed:', error.message);
      return false;
    }
  }

  /**
   * List available camera sources
   * 
   * @returns {Promise<Object>} List of available cameras and source types
   */
  async listCameras() {
    try {
      const response = await axios.get(`${OPENCV_SERVICE_URL}/cameras`, {
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      console.error('List cameras error:', error.message);
      throw new Error(`Failed to list cameras: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Test camera connection
   * 
   * @param {string} source - Camera source (e.g., "camera://0", file path)
   * @returns {Promise<Object>} Test result
   */
  async testCamera(source) {
    try {
      const response = await axios.post(`${OPENCV_SERVICE_URL}/test-camera`, {
        source: source,
      }, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      console.error('Test camera error:', error.message);
      throw new Error(`Failed to test camera: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Define slot regions from an image
   * Note: This is typically called interactively, so it may return an error
   * if used via API. The slot selector is meant to be run standalone.
   * 
   * @param {string} imagePath - Path to reference image
   * @param {string} outputPath - Optional output path for slots JSON
   * @returns {Promise<Object>} Slots definition
   */
  async defineSlots(imagePath, outputPath = null) {
    try {
      const response = await axios.post(`${OPENCV_SERVICE_URL}/define-slots`, {
        image_path: imagePath,
        output_path: outputPath,
      }, {
        timeout: 300000, // 5 minutes for interactive process
      });
      return response.data;
    } catch (error) {
      console.error('Define slots error:', error.message);
      throw new Error(`Failed to define slots: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Detect occupancy for all slots
   * 
   * @param {string} imagePath - Path to current parking lot image
   * @param {Array} slots - Array of slot definitions with coordinates
   * @param {number} threshold - Optional detection threshold (0-1)
   * @returns {Promise<Array>} Array of slot occupancy results
   */
  async detectOccupancy(imagePath, slots, threshold = null) {
    try {
      const payload = {
        image_path: imagePath,
        slots: slots.map(slot => ({
          slot_id: slot.slotId || slot.slot_id || `S${slot.slotNumber}`, // Use provided slotId or generate S{number}
          slot_number: slot.slotNumber,
          coordinates: slot.coordinates,
          image_width: slot.imageWidth,
          image_height: slot.imageHeight,
        })),
      };

      if (threshold !== null) {
        payload.threshold = threshold;
      }

      const response = await axios.post(`${OPENCV_SERVICE_URL}/detect-occupancy`, payload, {
        timeout: 30000, // 30 seconds
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Detection failed');
      }

      return response.data.results;
    } catch (error) {
      console.error('Detect occupancy error:', error.message);
      throw new Error(`Failed to detect occupancy: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Detect occupancy for a single slot
   * 
   * @param {string} imagePath - Path to current parking lot image
   * @param {Array} coordinates - Normalized coordinates [0-1] of slot region
   * @param {number} imageWidth - Original image width
   * @param {number} imageHeight - Original image height
   * @param {number} threshold - Optional detection threshold (0-1)
   * @returns {Promise<Object>} Slot occupancy result
   */
  async detectSingleSlot(imagePath, coordinates, imageWidth, imageHeight, threshold = null) {
    try {
      const payload = {
        image_path: imagePath,
        slot_coordinates: coordinates,
        image_width: imageWidth,
        image_height: imageHeight,
      };

      if (threshold !== null) {
        payload.threshold = threshold;
      }

      const response = await axios.post(`${OPENCV_SERVICE_URL}/detect-single`, payload, {
        timeout: 10000, // 10 seconds
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Detection failed');
      }

      return response.data;
    } catch (error) {
      console.error('Detect single slot error:', error.message);
      throw new Error(`Failed to detect slot occupancy: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Detect occupancy using YOLO vehicle detection
   * 
   * @param {string} imagePath - Path to current parking lot image
   * @param {Array} slots - Array of slot definitions with coordinates
   * @param {Object} yoloConfig - YOLO configuration (modelPath, thresholds)
   * @returns {Promise<Array>} Array of slot occupancy results with vehicle metadata
   */
  async detectOccupancyYOLO(imagePath, slots, yoloConfig = {}) {
    try {
      const payload = {
        image_path: imagePath,
        slots: slots.map(slot => ({
          slot_id: slot.slotId || slot.slot_id || `S${slot.slotNumber}`,
          slot_number: slot.slotNumber,
          coordinates: slot.coordinates,
          image_width: slot.imageWidth,
          image_height: slot.imageHeight,
        })),
        model_path: yoloConfig.modelPath || 'models/yolo11s.pt',
        conf_threshold: yoloConfig.confThreshold || 0.35,
        iou_threshold: yoloConfig.iouThreshold || 0.45,
        occupied_threshold: yoloConfig.occupiedThreshold || 0.30,
      };

      const response = await axios.post(`${OPENCV_SERVICE_URL}/detect-yolo`, payload, {
        timeout: 30000, // 30 seconds
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'YOLO detection failed');
      }

      return response.data.results;
    } catch (error) {
      console.error('YOLO detect occupancy error:', error.message);
      throw new Error(`Failed to detect occupancy with YOLO: ${error.response?.data?.error || error.message}`);
    }
  }
}

module.exports = new OpenCVService();

