import { useState, useRef, useEffect } from 'react';

const CameraSlotSelector = ({ onSlotsSelected, onClose }) => {
  const [stream, setStream] = useState(null);
  const [slots, setSlots] = useState([]);
  const [currentSlot, setCurrentSlot] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup: stop stream when component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera if available
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      alert('Could not access camera. Please ensure camera permissions are granted.');
      console.error('Camera error:', error);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageDataUrl);
    setImageData({
      width: video.videoWidth,
      height: video.videoHeight,
      dataUrl: imageDataUrl
    });
    setIsCapturing(true);
    
    // Stop the video stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCanvasClick = (e) => {
    if (!isCapturing || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setCurrentSlot([...currentSlot, { x, y }]);
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    if (currentSlot.length > 0) {
      setCurrentSlot(currentSlot.slice(0, -1));
    }
  };

  const finishSlot = () => {
    if (currentSlot.length >= 3) {
      setSlots([...slots, { points: [...currentSlot], id: slots.length + 1 }]);
      setCurrentSlot([]);
    } else {
      alert('A slot needs at least 3 points. Please add more points.');
    }
  };

  const removeSlot = (index) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const reset = () => {
    setSlots([]);
    setCurrentSlot([]);
    setCapturedImage(null);
    setImageData(null);
    setIsCapturing(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const confirmSlots = () => {
    if (slots.length === 0) {
      alert('Please define at least one parking slot.');
      return;
    }

    // Convert slots to the format expected by the backend
    const formattedSlots = slots.map((slot, index) => ({
      slot_number: index + 1,
      coordinates: slot.points.map(p => [p.x / imageData.width, p.y / imageData.height]), // Normalize to 0-1
      imageWidth: imageData.width,
      imageHeight: imageData.height
    }));

    onSlotsSelected({
      slots: formattedSlots,
      imageData: imageData.dataUrl,
      totalSlots: slots.length
    });
  };


  useEffect(() => {
    if (isCapturing && capturedImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const image = new Image();
      image.src = capturedImage;
      
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        
        // Draw completed slots
        slots.forEach((slot, slotIndex) => {
          if (slot.points.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(slot.points[0].x, slot.points[0].y);
            for (let i = 1; i < slot.points.length; i++) {
              ctx.lineTo(slot.points[i].x, slot.points[i].y);
            }
            ctx.closePath();
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.fill();
            
            // Draw slot number
            const centerX = slot.points.reduce((sum, p) => sum + p.x, 0) / slot.points.length;
            const centerY = slot.points.reduce((sum, p) => sum + p.y, 0) / slot.points.length;
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`S${slotIndex + 1}`, centerX - 10, centerY);
          }
        });
        
        // Draw current slot being defined
        if (currentSlot.length > 0) {
          ctx.beginPath();
          ctx.moveTo(currentSlot[0].x, currentSlot[0].y);
          for (let i = 1; i < currentSlot.length; i++) {
            ctx.lineTo(currentSlot[i].x, currentSlot[i].y);
          }
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.stroke();
          
          // Draw points
          currentSlot.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ff0000';
            ctx.fill();
          });
        }
      };
    }
  }, [slots, currentSlot, isCapturing, capturedImage]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Select Parking Slots</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {!isCapturing ? (
            <div className="text-center py-8">
              {!stream ? (
                <>
                  <p className="mb-4 text-gray-700">Click below to start your camera</p>
                  <button
                    onClick={startCamera}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                  >
                    📷 Start Camera
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="max-w-full h-auto rounded-lg border-2 border-gray-300"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <button
                    onClick={captureFrame}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition"
                  >
                    📸 Capture Frame
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="bg-gray-100 p-4 rounded-lg mb-4">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Instructions:</strong>
                  </p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>Left-click to add points to define a parking slot</li>
                    <li>Right-click to remove the last point</li>
                    <li>Click "Finish Slot" when you've defined all points (minimum 3 points)</li>
                    <li>Define all slots, then click "Confirm"</li>
                  </ul>
                </div>
                
                <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onContextMenu={handleRightClick}
                    className="w-full h-auto cursor-crosshair"
                    style={{ maxHeight: '60vh' }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {slots.map((slot, index) => (
                    <div
                      key={index}
                      className="bg-green-100 px-3 py-1 rounded-full text-sm font-semibold text-green-800 flex items-center gap-2"
                    >
                      Slot {index + 1}
                      <button
                        onClick={() => removeSlot(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  <p>Current slot: {currentSlot.length} points</p>
                  <p>Total slots defined: {slots.length}</p>
                </div>
              </div>

              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={finishSlot}
                  disabled={currentSlot.length < 3}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Finish Slot ({currentSlot.length} points)
                </button>
                <button
                  onClick={reset}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
                >
                  Reset All
                </button>
                <button
                  onClick={confirmSlots}
                  disabled={slots.length === 0}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed ml-auto"
                >
                  ✓ Confirm ({slots.length} slots)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraSlotSelector;

