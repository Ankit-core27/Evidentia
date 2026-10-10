import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Dna,
  Radio,
  UserPlus,
  Shield,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  FolderPlus,
  Zap,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { ForensicCase, Investigator, PersonOfInterest, CasePriority } from '@/types';

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  investigators: Investigator[];
  onCreateCase: (newCase: ForensicCase) => void;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  isOpen,
  onClose,
  investigators,
  onCreateCase
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<CasePriority>('CRITICAL');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [description, setDescription] = useState('');
  const [leadInvestigatorId, setLeadInvestigatorId] = useState(investigators[0]?.id || '');

  // File Upload state simulation
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; type: string }[]>([
    { name: 'Autopsy_Exam_Report_ME-90.pdf', size: '12.4 MB', type: 'Autopsy' },
    { name: 'DNA_Sequencing_NovaSeq_B42.fasta', size: '450.0 MB', type: 'DNA' },
    { name: 'GPS_Telemetry_Tower409.json', size: '82.1 MB', type: 'GPS' }
  ]);
  const [isDragging, setIsDragging] = useState(false);

  // POIs state
  const [pois, setPois] = useState<{ name: string; role: 'Suspect' | 'Witness'; notes: string }[]>([
    { name: 'Victor Vance', role: 'Suspect', notes: 'Cell tower ping places suspect at scene.' }
  ]);
  const [newPoiName, setNewPoiName] = useState('');
  const [newPoiRole, setNewPoiRole] = useState<'Suspect' | 'Witness'>('Suspect');
  const [newPoiNotes, setNewPoiNotes] = useState('');

  if (!isOpen) return null;

  const handleAddPoi = () => {
    if (!newPoiName.trim()) return;
    setPois([...pois, { name: newPoiName, role: newPoiRole, notes: newPoiNotes }]);
    setNewPoiName('');
    setNewPoiNotes('');
  };

  const handleRemovePoi = (index: number) => {
    setPois(pois.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadedFiles([
        ...uploadedFiles,
        {
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          type: file.name.includes('dna') ? 'DNA' : file.name.includes('gps') ? 'GPS' : 'Autopsy'
        }
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const lead = investigators.find((i) => i.id === leadInvestigatorId) || investigators[0];
    const newCaseId = `FX-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const createdCase: ForensicCase = {
      id: newCaseId,
      title: title || 'Operation Phantom Grid: Unspecified Incident',
      status: 'Forensic Testing',
      priority,
      leadInvestigator: lead,
      dateCreated: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0],
      incidentLocation: incidentLocation || 'District 7 Metropolitan Sector',
      description: description || 'New investigation initiated with AI telemetry and automated evidence ingest.',
      evidenceCount: uploadedFiles.length,
      aiConfidenceScore: 92.5,
      progressPercent: 35,
      victim: {
        id: `VIC-${Math.floor(1000 + Math.random() * 9000)}`,
        name: 'Victim Subject Alpha',
        age: 44,
        occupation: 'Executive',
        status: 'Deceased - Confirmed',
        causeOfDeath: 'Under Forensic Testing (Autopsy in Progress)',
        timeOfDeath: `${new Date().toISOString().split('T')[0]} 21:00 UTC`,
        dnaMatchVerification: 'STR Loci Swab Analysis Active',
        autopsySummary: 'Ingested evidence files queued for multi-spectral decomposition and toxicology screening.'
      },
      evidenceList: uploadedFiles.map((f, idx) => ({
        id: `EVD-NEW-${idx}`,
        caseId: newCaseId,
        title: f.name,
        type: (f.type as any) || 'Digital File',
        dateAdded: new Date().toISOString(),
        fileSize: f.size,
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        chainOfCustody: [{ officer: lead.name, timestamp: new Date().toISOString(), action: 'Ingested to Evidence Locker' }],
        summary: 'Newly uploaded evidence file pending deep spectral and neural feature extraction.',
        aiInsights: 'File integrity verified via SHA-256 hash checksum.'
      })),
      personsOfInterest: pois.map((p, idx) => ({
        id: `POI-NEW-${idx}`,
        name: p.name,
        role: p.role,
        threatLevel: p.role === 'Suspect' ? 'High' : 'Moderate',
        alibiStatus: 'Unverified',
        notes: p.notes
      })),
      timeline: [
        {
          id: 'TL-INIT-1',
          caseId: newCaseId,
          timestamp: new Date().toISOString(),
          timeDisplay: '00:01 PST',
          title: 'Case Dossier Created',
          description: `Case dossier initialized by ${lead.name}. ${uploadedFiles.length} evidence files ingested.`,
          category: 'Telecom',
          isAiFlagged: true,
          aiBreakthroughReason: 'AI Evidence Hash & Telemetry Ingestion Complete.'
        }
      ],
      injuries: [
        {
          id: 'INJ-NEW-1',
          region: 'head',
          title: 'Primary Cranial Impact',
          type: 'Blunt Force Trauma',
          severity: 'Severe',
          depth: '1.5 cm',
          description: 'Cranial contusion identified from autopsy scan.',
          estimatedTimeOfInjury: '22:15 PST',
          aiNotes: 'Spectral analysis aligns with heavy metallic object.',
          coordinates: { x: 50, y: 15 }
        }
      ],
      networkNodes: [
        { id: 'NODE-NewSuspect', label: pois[0]?.name || 'Suspect Alpha', sublabel: 'Prime Suspect', type: 'Suspect', x: 300, y: 180, threatLevel: 'High', color: '#ef4444' },
        { id: 'NODE-NewVictim', label: 'Victim Subject 1', sublabel: 'Deceased', type: 'Victim', x: 500, y: 280, threatLevel: 'Low', color: '#3b82f6' }
      ],
      networkLinks: [
        { source: 'NODE-NewSuspect', target: 'NODE-NewVictim', label: 'Under Investigation', strength: 4, isSuspicious: true }
      ]
    };

    onCreateCase(createdCase);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider">
                INITIATE NEW FORENSIC INVESTIGATION
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Step {step} of 3 • AI Automated Ingest Pipeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="px-6 py-3 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between font-mono text-xs">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800'}`}>1</span>
            <span>Case Overview</span>
          </div>

          <div className="w-8 h-px bg-slate-800"></div>

          <div className={`flex items-center gap-2 ${step === 2 ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800'}`}>2</span>
            <span>Evidence Upload</span>
          </div>

          <div className="w-8 h-px bg-slate-800"></div>

          <div className={`flex items-center gap-2 ${step === 3 ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800'}`}>3</span>
            <span>Team & POIs</span>
          </div>
        </div>

        {/* Form Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Case Details */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-mono text-slate-300 font-semibold mb-1.5 uppercase">
                  Case Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Operation Cipher Ghost: Harbor Penthouse Homicide"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 font-semibold mb-1.5 uppercase">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as CasePriority)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CRITICAL">Critical (Immediate AI Analysis)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 font-semibold mb-1.5 uppercase">
                    Incident Location
                  </label>
                  <input
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    placeholder="e.g. Skyline Plaza Penthouse B, Sector 4"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 font-semibold mb-1.5 uppercase">
                  Lead Investigator
                </label>
                <select
                  value={leadInvestigatorId}
                  onChange={(e) => setLeadInvestigatorId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                >
                  {investigators.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} — {inv.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 font-semibold mb-1.5 uppercase">
                  Incident Summary & Briefing
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide preliminary autopsy notes, crime scene observations, and suspect alibi context..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500 resize-none"
                ></textarea>
              </div>
            </div>
          )}

          {/* STEP 2: File / Evidence Drag & Drop Zone */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-mono font-bold text-slate-200 uppercase">
                  DRAG & DROP EVIDENCE FILES HERE
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports Autopsy PDFs, DNA sequencing (.fasta), GPS logs (.gpx/JSON), Suspect profiles, & Witness transcripts (.mp3)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFiles([
                      ...uploadedFiles,
                      { name: 'Witness_Transcript_Audio_Interrogation.mp3', size: '24.2 MB', type: 'Audio/Transcript' }
                    ]);
                  }}
                  className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg border border-slate-700 inline-block"
                >
                  Or Select Files from System
                </button>
              </div>

              {/* Uploaded File List */}
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase block mb-2 font-semibold">
                  Pending Files for AI Ingestion ({uploadedFiles.length})
                </span>

                <div className="space-y-2">
                  {uploadedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 border border-slate-800">
                          {file.type === 'DNA' ? (
                            <Dna className="w-4 h-4 text-emerald-400" />
                          ) : file.type === 'GPS' ? (
                            <Radio className="w-4 h-4 text-amber-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-cyan-400" />
                          )}
                        </div>
                        <div>
                          <span className="text-slate-200 font-semibold block">{file.name}</span>
                          <span className="text-[10px] text-slate-500">
                            Size: {file.size} • Hash SHA-256 Validated
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setUploadedFiles(uploadedFiles.filter((_, idx) => idx !== i))}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Assign Persons of Interest */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-slate-200 uppercase block">
                  Add Person of Interest (POI)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newPoiName}
                    onChange={(e) => setNewPoiName(e.target.value)}
                    placeholder="Full Name (e.g. Victor Vance)"
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />

                  <select
                    value={newPoiRole}
                    onChange={(e) => setNewPoiRole(e.target.value as 'Suspect' | 'Witness')}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Suspect">Suspect</option>
                    <option value="Witness">Witness</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={newPoiNotes}
                  onChange={(e) => setNewPoiNotes(e.target.value)}
                  placeholder="Key observations / Alibi statements..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />

                <button
                  type="button"
                  onClick={handleAddPoi}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add POI Subject
                </button>
              </div>

              {/* POI List */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-slate-400 uppercase block font-semibold">
                  Key Subjects Assigned ({pois.length})
                </span>

                {pois.map((poi, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{poi.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            poi.role === 'Suspect'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {poi.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{poi.notes}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePoi(idx)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between font-mono">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 2 | 3)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                Next Step <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                INITIALIZE FORENSIC DOSSIER
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
