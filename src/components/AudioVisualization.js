import React, { useState, useEffect, useRef } from 'react';
import p5 from 'p5';

const AudioVisualization = () => {
  // State variables
  const [isListening, setIsListening] = useState(false);
  const [visualizationType, setVisualizationType] = useState('circle');
  const [sensitivity, setSensitivity] = useState(5);
  const [audioSource, setAudioSource] = useState('microphone');
  const [fileName, setFileName] = useState('No file chosen');
  
  // Refs
  const containerRef = useRef(null);
  const p5Ref = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const audioElementRef = useRef(null);
  const dataArrayRef = useRef(null);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (p5Ref.current) {
        p5Ref.current.resizeCanvas(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize p5 sketch
  useEffect(() => {
    const sketch = (p) => {
      let width, height;
      
      p.setup = () => {
        width = containerRef.current.clientWidth;
        height = containerRef.current.clientHeight;
        p.createCanvas(width, height);
        p.colorMode(p.HSB, 255);
        p.noStroke();
      };
      
      p.draw = () => {
        if (!dataArrayRef.current || !isListening) return;
        
        p.background(0, 0, 20, 20); // Dark background with transparency
        
        const bufferLength = dataArrayRef.current.length;
        const dataArray = dataArrayRef.current;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength * (sensitivity / 5);
        
        // Draw appropriate visualization
        if (visualizationType === 'circle') {
          drawCircleVisualization(p, dataArray, bufferLength, average);
        } else if (visualizationType === 'bars') {
          drawBarsVisualization(p, dataArray, bufferLength);
        } else if (visualizationType === 'wave') {
          drawWaveVisualization(p, dataArray, bufferLength);
        }
      };
      
      // Circle visualization
      const drawCircleVisualization = (p, dataArray, bufferLength, average) => {
        p.translate(width / 2, height / 2);
        
        const bassValue = getFrequencyRangeValue(dataArray, 0, 100);
        const midValue = getFrequencyRangeValue(dataArray, 100, 2000);
        const trebleValue = getFrequencyRangeValue(dataArray, 2000, 16000);
        
        // Draw outer circle (treble)
        p.fill(200, 255, trebleValue * sensitivity);
        p.circle(0, 0, trebleValue * sensitivity * 3);
        
        // Draw middle circle (mid)
        p.fill(100, 255, midValue * sensitivity);
        p.circle(0, 0, midValue * sensitivity * 2);
        
        // Draw inner circle (bass)
        p.fill(0, 255, bassValue * sensitivity);
        p.circle(0, 0, bassValue * sensitivity);
      };
      
      // Bar visualization
      const drawBarsVisualization = (p, dataArray, bufferLength) => {
        const barWidth = width / (bufferLength / 4);
        
        for (let i = 0; i < bufferLength / 4; i++) {
          const barHeight = dataArray[i] * (sensitivity / 2);
          const hue = (i / (bufferLength / 4)) * 255;
          
          p.fill(hue, 255, 255);
          p.rect(i * barWidth, height - barHeight, barWidth, barHeight);
        }
      };
      
      // Wave visualization
      const drawWaveVisualization = (p, dataArray, bufferLength) => {
        p.stroke(255);
        p.noFill();
        p.beginShape();
        
        analyserRef.current.getByteTimeDomainData(dataArray);
        const sliceWidth = width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * height / 2;
          
          if (i === 0) {
            p.vertex(x, y);
          } else {
            p.vertex(x, y);
          }
          
          x += sliceWidth;
        }
        
        p.endShape();
        p.noStroke();
      };
      
      // Helper to get frequency range average
      const getFrequencyRangeValue = (dataArray, startFreq, endFreq) => {
        const startIndex = Math.floor(startFreq / 22050 * dataArray.length);
        const endIndex = Math.floor(endFreq / 22050 * dataArray.length);
        
        let sum = 0;
        for (let i = startIndex; i < endIndex; i++) {
          sum += dataArray[i];
        }
        return sum / (endIndex - startIndex);
      };
      
      // Handle window resize
      p.windowResized = () => {
        if (containerRef.current) {
          width = containerRef.current.clientWidth;
          height = containerRef.current.clientHeight;
          p.resizeCanvas(width, height);
        }
      };
    };

    // Create p5 instance
    if (containerRef.current && !p5Ref.current) {
      p5Ref.current = new p5(sketch, containerRef.current);
    }
    
    return () => {
      if (p5Ref.current) {
        p5Ref.current.remove();
        p5Ref.current = null;
      }
    };
  }, [isListening, visualizationType, sensitivity]);

  // Start audio analysis
  const startAudioAnalysis = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
      }
      
      if (audioSource === 'microphone') {
        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
        
        setIsListening(true);
      } else if (audioSource === 'file' && audioElementRef.current && audioElementRef.current.files[0]) {
        if (sourceRef.current) {
          sourceRef.current.disconnect();
        }
        
        const fileURL = URL.createObjectURL(audioElementRef.current.files[0]);
        const audio = new Audio();
        audio.src = fileURL;
        audio.play();
        
        sourceRef.current = audioContextRef.current.createMediaElementSource(audio);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
        
        setIsListening(true);
      }
    } catch (error) {
      console.error('Error accessing audio:', error);
      alert('Error accessing audio: ' + error.message);
    }
  };

  // Stop audio analysis
  const stopAudioAnalysis = () => {
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    setIsListening(false);
  };

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    } else {
      setFileName('No file chosen');
    }
  };

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Control Panel */}
      <div className="w-full p-4 bg-black text-cyan-400 border-b border-cyan-500 flex flex-wrap justify-center items-center gap-4">
        {/* Source Selection */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Source:</label>
          <select 
            className="bg-gray-900 rounded px-2 py-1 text-sm border border-cyan-500"
            value={audioSource}
            onChange={(e) => setAudioSource(e.target.value)}
          >
            <option value="microphone">Microphone</option>
            <option value="file">Audio File</option>
          </select>
        </div>
        
        {/* File Upload (conditionally) */}
        {audioSource === 'file' && (
          <div className="flex items-center gap-2">
            <label className="px-2 py-1 text-sm border border-pink-500 rounded cursor-pointer">
              <span>Choose File</span>
              <input
                type="file"
                accept="audio/*"
                ref={audioElementRef}
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            <span className="text-xs text-gray-400">{fileName}</span>
          </div>
        )}
        
        {/* Visualization Type */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Visual:</label>
          <select 
            className="bg-gray-900 rounded px-2 py-1 text-sm border border-cyan-500"
            value={visualizationType}
            onChange={(e) => setVisualizationType(e.target.value)}
          >
            <option value="circle">Circles</option>
            <option value="bars">Bars</option>
            <option value="wave">Wave</option>
          </select>
        </div>
        
        {/* Sensitivity */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Sensitivity:</label>
          <input
            type="range"
            min="1"
            max="10"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-sm">{sensitivity}</span>
        </div>
        
        {/* Start/Stop Button */}
        <button
          onClick={isListening ? stopAudioAnalysis : startAudioAnalysis}
          className={`px-4 py-1 rounded text-sm ${
            isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'
          }`}
        >
          {isListening ? 'Stop' : 'Start'}
        </button>
      </div>
      
      {/* Visualization Container */}
      <div 
        ref={containerRef} 
        className="flex-grow w-full bg-black"
      >
        {!isListening && (
          <div className="h-full w-full flex items-center justify-center">
            <p className="text-cyan-400 text-xl">Select your audio source and press Start</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioVisualization;