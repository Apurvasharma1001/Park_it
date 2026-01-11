import { useState, useRef, useEffect } from 'react';

const LiveCameraSlotSelector = ({ onSlotsSelected, onClose }) => {
  const [stream, setStream] = useState(null);
  const [slots, setSlots] = useState([]);
  const [currentSlot, setCurrentSlot] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorString, setErrorString] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  // robust cleanup effect
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          console.log("Stopping track:", track.label);
          track.stop();
        });
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [stream]);

  const updateDebugInfo = () => {
    if (videoRef.current) {
      setDebugInfo({
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight,
        readyState: videoRef.current.readyState,
        srcObject: videoRef.current.srcObject ? 'Present' : 'Null',
        paused: videoRef.current.paused,
        muted: videoRef.current.muted,
        error: videoRef.current.error ? videoRef.current.error.message : 'None'
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(updateDebugInfo, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const startCamera = async () => {
    setErrorString(null);
    try {
      console.log("Requesting camera access...");

      // Simple constraints first - just get ANY video
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true // Simplified constraint to match test-camera.html
      });

      console.log("Stream obtained:", mediaStream.id);
      setStream(mediaStream);
      setIsStreaming(true);

      // We perform DOM updates in a timeout to ensure React has rendered the video element
      setTimeout(() => {
        if (videoRef.current) {
          console.log("Setting video srcObject");
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            console.log("Metadata loaded, attempting play()");
            videoRef.current.play()
              .then(() => console.log("Video playing successfully"))
              .catch(e => {
                console.error("Play failed:", e);
                setErrorString("Play failed: " + e.message);
              });
          };
        } else {
          console.error("Video ref is null despite state update");
          setErrorString("Critical Error: Video element not found in DOM");
        }
      }, 100);

    } catch (error) {
      console.error('Camera error:', error);
      setErrorString(`Camera Error: ${error.name} - ${error.message}`);
    }
  };

  // Simplified Draw Loop (Cleaned up)
  useEffect(() => {
    if (!isStreaming || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      // 1. Resize Canvas if needed
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
        }
      }

      // 2. Clear Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 3. Draw Slots
      slots.forEach((slot, idx) => {
        if (slot.points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(slot.points[0].x, slot.points[0].y);
        for (let i = 1; i < slot.points.length; i++) ctx.lineTo(slot.points[i].x, slot.points[i].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Text
        const cx = slot.points.reduce((s, p) => s + p.x, 0) / slot.points.length;
        const cy = slot.points.reduce((s, p) => s + p.y, 0) / slot.points.length;
        ctx.fillStyle = '#00ff00'; ctx.font = 'bold 24px Arial'; ctx.fillText(`S${idx + 1}`, cx - 10, cy);
      });

      // 4. Draw Current Slot
      if (currentSlot.length > 0) {
        ctx.beginPath();
        ctx.moveTo(currentSlot[0].x, currentSlot[0].y);
        for (let i = 1; i < currentSlot.length; i++) ctx.lineTo(currentSlot[i].x, currentSlot[i].y);
        ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3; ctx.stroke();
        currentSlot.forEach(p => {
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 6.28); ctx.fillStyle = 'red'; ctx.fill();
        });
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isStreaming, slots, currentSlot]);

  // Handle Interactions
  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setCurrentSlot([...currentSlot, { x, y }]);
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    if (currentSlot.length > 0) setCurrentSlot(currentSlot.slice(0, -1));
  };

  const finishSlot = () => {
    if (currentSlot.length >= 3) {
      setSlots([...slots, { points: [...currentSlot], id: Date.now() }]);
      setCurrentSlot([]);
    } else alert("Need at least 3 points");
  };

  const reset = () => { setSlots([]); setCurrentSlot([]); };

  const confirmSlots = () => {
    if (slots.length === 0) return alert('Define at least one slot');
    if (!videoRef.current) return;

    const v = videoRef.current;
    const tempC = document.createElement('canvas');
    tempC.width = v.videoWidth; tempC.height = v.videoHeight;
    tempC.getContext('2d').drawImage(v, 0, 0);

    const formattedSlots = slots.map((s, i) => ({
      slot_number: i + 1,
      coordinates: s.points.map(p => [p.x / v.videoWidth, p.y / v.videoHeight]),
      imageWidth: v.videoWidth,
      imageHeight: v.videoHeight
    }));

    onSlotsSelected({
      slots: formattedSlots,
      imageData: tempC.toDataURL('image/jpeg'),
      imageWidth: v.videoWidth,
      imageHeight: v.videoHeight,
      totalSlots: slots.length
    });
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsStreaming(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[98vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-100">
          <h2 className="text-xl font-bold">Camera Slot Configuration (Debug Mode)</h2>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-3xl font-bold px-4">×</button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col items-center">

          {/* Error / Status Box */}
          {errorString && <div className="w-full bg-red-100 text-red-800 p-3 mb-4 rounded border border-red-400 font-bold">{errorString}</div>}

          {/* Debug Info Overlay */}
          {isStreaming && (
            <div className="w-full text-xs font-mono bg-gray-800 text-green-400 p-2 mb-2 rounded grid grid-cols-2 gap-2">
              <div>Res: {debugInfo.videoWidth}x{debugInfo.videoHeight}</div>
              <div>State: {debugInfo.readyState}</div>
              <div>Src: {debugInfo.srcObject}</div>
              <div>Paused: {debugInfo.paused ? 'YES' : 'NO'}</div>
            </div>
          )}

          {!isStreaming ? (
            <div className="py-20 text-center">
              <button onClick={startCamera} className="bg-blue-600 text-white text-xl px-10 py-5 rounded-lg hover:bg-blue-700 shadow-lg font-bold">
                📷 Start Camera
              </button>
              <p className="mt-4 text-gray-500">Using simplified constraints matching test page.</p>
            </div>
          ) : (
            <>
              {/* VIDEO CONTAINER - Forced Styles for visibility */}
              <div className="relative bg-black border-4 border-blue-500 w-full" style={{ minHeight: '400px', maxWidth: '1000px' }}>

                {/* The Video Element - High Z-Index to ensure visibility */}
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
                    zIndex: 1, // Base layer
                    background: '#333'
                  }}
                />

                {/* The Canvas Overlay - Higher Z-Index */}
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onContextMenu={handleRightClick}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10, // Top layer
                    cursor: 'crosshair',
                    pointerEvents: 'auto'
                  }}
                />
              </div>

              {/* Controls */}
              <div className="mt-4 flex flex-wrap gap-4 justify-center w-full bg-gray-50 p-4 rounded border">
                <div className="w-full text-center text-sm font-semibold mb-2">
                  Points: {currentSlot.length} | Slots: {slots.length} | Left Click: Add | Right Click: Remove
                </div>
                <button onClick={finishSlot} className="bg-blue-600 text-white px-6 py-2 rounded shadow">Finish Slot</button>
                <button onClick={reset} className="bg-gray-500 text-white px-6 py-2 rounded shadow">Reset</button>
                <button onClick={confirmSlots} disabled={slots.length === 0} className="bg-green-600 text-white px-8 py-2 rounded shadow font-bold">Confirm & Save</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveCameraSlotSelector;
