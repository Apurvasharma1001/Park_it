import { useState, useRef, useEffect } from 'react';
import { parkingLotAPI } from '../services/api';

const LiveOccupancyTracker = ({ parkingLotId, slots, onClose }) => {
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [slotStatuses, setSlotStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorString, setErrorString] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // robust cleanup
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [stream]);

  const startCamera = async () => {
    setErrorString(null);
    try {
      console.log("Requesting occupancy camera...");

      // Simplified constraints shared with the working debug component
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true
      });

      console.log("Stream obtained:", mediaStream.id);
      setStream(mediaStream);
      setIsStreaming(true);

      // DOM update timeout to ensure render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play()
              .then(() => {
                console.log("Video playing");
                startDetection(); // start backend loop
              })
              .catch(e => {
                console.error("Play failed:", e);
                setErrorString("Play failed: " + e.message);
              });
          };
        }
      }, 100);

    } catch (error) {
      console.error('Camera error:', error);
      setErrorString(`Camera Error: ${error.name} - ${error.message}`);
    }
  };

  const captureFrameForDetection = () => {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    if (v.videoWidth === 0) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = v.videoWidth;
    tempCanvas.height = v.videoHeight;
    tempCanvas.getContext('2d').drawImage(v, 0, 0);
    return tempCanvas.toDataURL('image/jpeg');
  };

  const startDetection = () => {
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || loading) return;

      try {
        setLoading(true);
        const imageData = captureFrameForDetection();
        if (!imageData) return; // skip if video not ready

        try {
          const response = await parkingLotAPI.processFrame(parkingLotId, imageData);
          if (response.data && response.data.slots) {
            const statusMap = {};
            response.data.slots.forEach(slot => {
              statusMap[slot.slot_number] = {
                status: slot.status,
                ratio: slot.occupancy_ratio
              };
            });
            setSlotStatuses(statusMap);
          }
        } catch (processError) {
          console.error("Process frame error, falling back to status check", processError);
          const response = await parkingLotAPI.getSlotStatus(parkingLotId);
          if (response.data && response.data.slots) {
            const statusMap = {};
            response.data.slots.forEach(slot => {
              statusMap[slot.slot_number] = {
                status: slot.status,
                ratio: slot.occupancy_ratio || slot.detectionMetadata?.occupancyRatio
              };
            });
            setSlotStatuses(statusMap);
          }
        }
      } catch (e) {
        console.error("Detection loop error:", e);
      } finally {
        setLoading(false);
      }
    }, 2000);
  };

  // Draw Overlay Loop
  useEffect(() => {
    if (!isStreaming || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        // Resize canvas if needed
        if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
        }

        // Clear previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Slots
        if (slots && slots.length > 0) {
          slots.forEach((slot, index) => {
            if (slot.coordinates && slot.coordinates.length >= 3) {

              // Transform normalized coordinates
              const points = slot.coordinates.map(c => {
                const xProp = Array.isArray(c) ? c[0] : (c.x || 0);
                const yProp = Array.isArray(c) ? c[1] : (c.y || 0);
                return { x: xProp * canvas.width, y: yProp * canvas.height };
              });

              ctx.beginPath();
              ctx.moveTo(points[0].x, points[0].y);
              for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
              ctx.closePath();

              const slotNum = slot.slot_number || (index + 1);
              // Handle new object structure vs old string structure
              const statusObj = slotStatuses[slotNum];
              const isOccupied = (statusObj?.status === 'occupied') || (statusObj === 'occupied');

              // Styles
              ctx.fillStyle = isOccupied ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 0, 0.3)';
              ctx.fill();
              ctx.strokeStyle = isOccupied ? '#ff0000' : '#00ff00';
              ctx.lineWidth = 3;
              ctx.stroke();

              // Text
              const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
              const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

              ctx.fillStyle = '#fff';
              ctx.font = 'bold 20px Arial';
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 3;
              const txt = `S${slotNum} ${isOccupied ? '🚗' : '🅿️'}`;
              ctx.strokeText(txt, cx - 30, cy);
              ctx.fillText(txt, cx - 30, cy);

              // Show Ratio Debug
              if (statusObj?.ratio !== undefined) {
                ctx.font = '14px monospace';
                const ratioText = `${(statusObj.ratio * 100).toFixed(1)}%`;
                ctx.strokeText(ratioText, cx - 20, cy + 20);
                ctx.fillText(ratioText, cx - 20, cy + 20);
              }
            }
          });
        }
      }
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isStreaming, slots, slotStatuses]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsStreaming(false);
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[98vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-100">
          <div>
            <h2 className="text-xl font-bold">Live Occupancy Tracking</h2>
            <p className="text-sm text-gray-600">Red = Occupied 🚗 | Green = Vacant 🅿️</p>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-3xl font-bold px-4">×</button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col items-center">

          {/* Error Box */}
          {errorString && <div className="w-full bg-red-100 text-red-800 p-3 mb-4 rounded border border-red-400 font-bold">{errorString}</div>}

          {!isStreaming ? (
            <div className="py-20 text-center">
              <button onClick={startCamera} className="bg-blue-600 text-white text-xl px-10 py-5 rounded-lg hover:bg-blue-700 shadow-lg font-bold">
                📷 Start Live Tracking
              </button>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="w-full flex justify-between mb-2">
                <button disabled={loading} className="bg-gray-200 px-3 py-1 rounded text-sm">
                  {loading ? 'Detecting...' : 'Scanning active (Every 2s)'}
                </button>
                <button onClick={stopCamera} className="bg-red-500 text-white px-4 py-1 rounded">Stop Camera</button>
              </div>

              {/* VIDEO CONTAINER - Forced Styles */}
              <div className="relative bg-black border-4 border-blue-500 w-full" style={{ minHeight: '400px', maxWidth: '1000px' }}>

                {/* Video - Base Layer */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    position: 'relative',
                    zIndex: 1,
                    background: '#333'
                  }}
                />

                {/* Canvas - Overlay Layer */}
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10,
                    pointerEvents: 'none' // allow clicks to pass through if needed, though interaction is mostly passive here
                  }}
                />
              </div>

              {/* Legend / Status Grid */}
              <div className="mt-4 w-full bg-gray-50 p-4 rounded border">
                <h3 className="font-semibold mb-2">Real-time Status:</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {slots && slots.map((slot, index) => {
                    const slotNum = slot.slot_number || (index + 1);
                    const statusObj = slotStatuses[slotNum];
                    const isOcc = (statusObj?.status === 'occupied') || (statusObj === 'occupied');
                    return (
                      <div key={index} className={`p-2 rounded text-center border-2 ${isOcc ? 'bg-red-100 border-red-500 text-red-800' : 'bg-green-100 border-green-500 text-green-800'}`}>
                        <div className="text-xl">{isOcc ? '🚗' : '🅿️'}</div>
                        <div className="font-bold text-xs">S{slotNum}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveOccupancyTracker;
