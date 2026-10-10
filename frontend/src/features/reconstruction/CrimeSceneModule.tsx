import React from 'react';
import { Box } from 'lucide-react';

// Placeholder from the UI draft, until the 3D track's viewer (features/crime-scene) is mounted here.
export const CrimeSceneModule: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Box className="w-5 h-5 text-cyan-400" />
            3D Crime Scene Spatial Floorplan & Telemetry
          </h2>
          <p className="text-xs text-slate-400">
            LiDAR point cloud reconstruction of Skyline Plaza Penthouse B.
          </p>
        </div>
      </div>

      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl relative min-h-[450px] flex flex-col items-center justify-center space-y-4">
        <div className="w-full max-w-xl h-80 bg-slate-950 border border-slate-800 rounded-2xl p-4 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:20px_20px] opacity-20"></div>

          {/* Spatial Floorplan Schematic */}
          <div className="w-full h-full border-2 border-slate-700 rounded-xl relative p-3 font-mono text-[10px]">
            <div className="absolute top-2 left-2 text-cyan-400 font-bold">Penthouse Study Room (402)</div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 rounded-lg border border-red-500 bg-red-500/20 text-red-300 font-bold text-center">
              Victim Location (Desk)
            </div>
            <div className="absolute bottom-4 right-4 p-2 rounded border border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold">
              Touch DNA Doorknob (#B-42)
            </div>
            <div className="absolute top-4 right-4 p-2 rounded border border-amber-500 bg-amber-500/20 text-amber-300 font-bold">
              RF Jammer Origin
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center max-w-md">
          Spatial point cloud confirms perpetrator entered via service balcony door at 22:36 PST and deployed localized RF frequency jammer.
        </p>
      </div>
    </div>
  );
};
