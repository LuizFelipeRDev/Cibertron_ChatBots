import { useEffect, useRef } from "react";

interface AudioWaveformProps {
  isRecording: boolean;
  audioStream: MediaStream | null;
  isDarkMode: boolean;
}

export default function AudioWaveform({ isRecording, audioStream, isDarkMode }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to match its container display size
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = canvas.parentElement?.clientHeight || 80;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let streamAnalyser: AnalyserNode | null = null;
    let audioCtx: AudioContext | null = null;

    if (isRecording && audioStream) {
      try {
        // Set up Web Audio API Analyser
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        
        const source = audioCtx.createMediaStreamSource(audioStream);
        streamAnalyser = audioCtx.createAnalyser();
        streamAnalyser.fftSize = 128; // Smaller fftSize for chunky cyberpunk visualizers
        
        source.connect(streamAnalyser);
        analyserRef.current = streamAnalyser;
      } catch (err) {
        console.error("Could not initialize audio visualizer:", err);
      }
    }

    const bufferLength = streamAnalyser ? streamAnalyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    // Simulated wave variables
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Dark theme background or light theme background
      ctx.fillStyle = isDarkMode ? "rgba(7, 7, 14, 0.2)" : "rgba(240, 240, 245, 0.2)";
      ctx.fillRect(0, 0, width, height);

      // Cyberpunk grid lines in the background of the canvas
      ctx.strokeStyle = isDarkMode ? "rgba(0, 240, 255, 0.05)" : "rgba(255, 0, 127, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 15;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (isRecording) {
        if (streamAnalyser) {
          // Real voice microphone visualization (frequency bars)
          streamAnalyser.getByteFrequencyData(dataArray);

          const barWidth = (width / bufferLength) * 1.5;
          let barHeight;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height * 0.85;

            // Gradient for cyberpunk neon feel (Pink to Cyan)
            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, "#9d4edd"); // Purple
            gradient.addColorStop(0.5, "#ff007f"); // Neon Pink
            gradient.addColorStop(1, "#00f0ff"); // Neon Cyan

            ctx.fillStyle = gradient;
            
            // Add custom drop-shadow blur effect to bars for neon glow
            ctx.shadowBlur = 4;
            ctx.shadowColor = isDarkMode ? "#00f0ff" : "#ff007f";

            // Draw rounded-corner cyberpunk columns
            ctx.beginPath();
            ctx.roundRect(x, height / 2 - barHeight / 2, barWidth - 2, barHeight, 3);
            ctx.fill();

            x += barWidth;
          }
          ctx.shadowBlur = 0; // Reset shadow
        } else {
          // Standard simulated cyber-waveform if Analyser failed but recording is active
          phase += 0.15;
          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#ff007f";
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#ff007f";

          for (let i = 0; i < width; i++) {
            const angle = (i / width) * Math.PI * 4 + phase;
            const y = height / 2 + Math.sin(angle) * (height * 0.35);
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset
        }
      } else {
        // Pinned standby state: smooth, slow, futuristic digital scanline sine wave
        phase += 0.03;
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDarkMode ? "rgba(0, 240, 255, 0.4)" : "rgba(255, 0, 127, 0.4)";
        ctx.shadowBlur = 4;
        ctx.shadowColor = isDarkMode ? "#00f0ff" : "#ff007f";

        for (let i = 0; i < width; i++) {
          const angle = (i / width) * Math.PI * 2 + phase;
          const y = height / 2 + Math.sin(angle) * 8 * Math.cos(angle * 0.5);
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [isRecording, audioStream, isDarkMode]);

  return (
    <div id="audio-waveform-container" className="w-full h-16 rounded bg-cyber-dark/80 relative overflow-hidden border border-cyber-cyan/20">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {isRecording && (
        <div id="recording-glow-badge" className="absolute top-2 right-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cyber-pink/20 border border-cyber-pink text-[10px] text-cyber-pink font-mono uppercase tracking-wider animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-cyber-pink animate-ping"></span>
          RECOR
        </div>
      )}
    </div>
  );
}
