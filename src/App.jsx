import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPitchShifted, setIsPitchShifted] = useState(false);
  const [activePitches, setActivePitches] = useState(new Set([0])); // Initialize with 0 selected
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const pitchPlayersRef = useRef(new Map()); // Map to store pitch-shifted players

  // Helper function to determine button color based on music theory
  const getIntervalStyle = (pitch) => {
    if (pitch === 0) return 'bg-white hover:bg-gray-200';
    
    // Get absolute value for checking interval type
    const absValue = Math.abs(pitch);
    
    // Perfect consonances (darker blue)
    const perfectConsonances = new Set([4, 7, 12]);
    if (perfectConsonances.has(absValue)) {
      return 'bg-blue-300 hover:bg-blue-400 text-blue-900';
    }
    
    // Imperfect consonances (lighter blue)
    const imperfectConsonances = new Set([3, 5, 8, 9]);
    if (imperfectConsonances.has(absValue)) {
      return 'bg-blue-100 hover:bg-blue-200 text-blue-900';
    }
    
    // Dissonant intervals (red tint)
    return 'bg-red-100 hover:bg-red-200 text-red-900';
  };

  // Generate pitch ranges for three rows
  const pitchRows = [
    Array.from({ length: 12 }, (_, i) => -(i + 1)), // -1 to -12
    [0], // Original pitch in its own row
    Array.from({ length: 12 }, (_, i) => i + 1), // +1 to +12
  ];

  useEffect(() => {
    // Cleanup function to dispose of all players when component unmounts
    return () => {
      pitchPlayersRef.current.forEach(({ player, pitchShift }) => {
        player.dispose();
        pitchShift.dispose();
      });
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const togglePitch = async (pitch) => {
    const newActivePitches = new Set(activePitches);
    
    if (newActivePitches.has(pitch)) {
      newActivePitches.delete(pitch);
      // Cleanup the player and pitch shift effect
      if (pitchPlayersRef.current.has(pitch)) {
        const { player, pitchShift } = pitchPlayersRef.current.get(pitch);
        player.dispose();
        pitchShift.dispose();
        pitchPlayersRef.current.delete(pitch);
      }
    } else {
      newActivePitches.add(pitch);
      if (audioBlob && !pitchPlayersRef.current.has(pitch)) {
        await setupPitchPlayer(pitch);
      }
    }
    
    setActivePitches(newActivePitches);
  };

  const setupPitchPlayer = async (pitch) => {
    const player = new Tone.Player().toDestination();
    const pitchShift = new Tone.PitchShift({
      pitch: pitch,
      windowSize: 0.1,
      delayTime: 0
    }).toDestination();

    player.disconnect();
    player.connect(pitchShift);

    pitchPlayersRef.current.set(pitch, { player, pitchShift });

    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      await player.load(audioUrl);
    }
  };

  const playRecording = async () => {
    if (audioBlob) {
      // Initialize Tone.js context if needed
      await Tone.start();
      
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and load players for any new active pitches
      for (const pitch of activePitches) {
        if (!pitchPlayersRef.current.has(pitch)) {
          await setupPitchPlayer(pitch);
        }
      }

      // Play all active pitch-shifted versions simultaneously
      const startTime = Tone.now();
      
      // Play all pitch-shifted versions
      pitchPlayersRef.current.forEach(({ player }) => {
        player.start(startTime);
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-black text-white">
      {/* Navbar */}
      <nav className="w-full h-[6.5vh] bg-black border-b border-white/10 flex items-center">
        <div className="container mx-auto px-8">
          <div className="flex items-center justify-between">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold tracking-wider">VocalHarmony</h1>
            </div>
            <div className="flex space-x-12">
              <a href="#" className="text-sm hover:text-gray-300 transition-colors">About</a>
              <a href="#" className="text-sm hover:text-gray-300 transition-colors">Contact</a>
              <a href="#" className="text-sm hover:text-gray-300 transition-colors">Pricing</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col items-center justify-center space-y-12">
        <div className="flex flex-col items-center space-y-8">
          {/* Recording controls */}
          <div className="flex space-x-6">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-8 py-4 rounded-lg font-medium text-lg transition-all transform hover:scale-105 ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
              {isRecording ? 'Stop Recording' : 'Record'}
            </button>
            <button
              onClick={playRecording}
              disabled={!audioBlob}
              className="px-8 py-4 rounded-lg font-medium text-lg bg-white text-black transition-all transform hover:scale-105 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Play
            </button>
          </div>

          {/* Pitch shift grid */}
          <div className="flex flex-col space-y-4">
            {pitchRows.map((row, rowIndex) => (
              <div key={rowIndex} className={`flex ${rowIndex === 1 ? 'justify-center w-full px-[calc((100%-6rem)/2)]' : 'space-x-2'}`}>
                {row.map((pitch) => (
                  <button
                    key={pitch}
                    onClick={() => togglePitch(pitch)}
                    disabled={!audioBlob}
                    className={`w-12 h-12 rounded-lg font-medium text-sm transition-all transform hover:scale-105 
                      ${activePitches.has(pitch)
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : getIntervalStyle(pitch)
                      } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                      ${pitch === 0 ? 'w-24' : ''}`}
                  >
                    {pitch > 0 ? `+${pitch}` : pitch}
                  </button>
                ))}
              </div>
            ))}

            {/* Legend */}
            <div className="mt-8 text-sm text-gray-300 flex flex-col items-center space-y-2">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-blue-300"></div>
                  <span>Perfect Consonances (±4, ±7, ±12)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-blue-100"></div>
                  <span>Imperfect Consonances (±3, ±5, ±8, ±9)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-red-100"></div>
                  <span>Dissonances (±1, ±2, ±6, ±10, ±11)</span>
                </div>
              </div>
              <div className="flex flex-col items-center text-xs text-gray-400 mt-2 space-y-1">
                <p>
                  <span className="font-semibold">Perfect Consonances:</span> Create strong, stable harmonies - great for endings and powerful moments
                </p>
                <p>
                  <span className="font-semibold">Imperfect Consonances:</span> Add warmth and richness - ideal for creating fuller, more colorful harmonies
                </p>
                <p>
                  <span className="font-semibold">Dissonances:</span> Create tension and movement - use to add interest or transition between consonant harmonies
                </p>
                <p className="mt-1 italic">
                  Try these combinations:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Major triad: +4 and +7 together</li>
                  <li>Minor triad: +3 and +7 together</li>
                  <li>Open fifth: -5 and +7 for a wide, spacious sound</li>
                  <li>Rich harmony: -3, +4, +7 for a three-part harmony</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
