import {
  ForensicCase,
  Investigator,
  IncidentMapPoint,
  SystemAlert,
  EvidenceItem
} from '@/types';

export const mockInvestigators: Investigator[] = [
  {
    id: 'INV-1001',
    name: 'Det. A. Sharma',
    role: 'Senior Lead Forensic Investigator',
    badgeId: 'BADGE-7091',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    casesSolved: 184,
    activeCases: 5,
    clearanceLevel: 'LEVEL 5 (TOP SECRET)'
  },
  {
    id: 'INV-1092',
    name: 'Dr. Evelyn Vance',
    role: 'Lead Digital & DNA Forensic Specialist',
    badgeId: 'BADGE-9941',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    casesSolved: 142,
    activeCases: 4,
    clearanceLevel: 'LEVEL 5 (TOP SECRET)'
  },
  {
    id: 'INV-2044',
    name: 'Agent Marcus Thorne',
    role: 'Senior Cyber & Telemetry Analyst',
    badgeId: 'BADGE-4412',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
    casesSolved: 98,
    activeCases: 3,
    clearanceLevel: 'LEVEL 4 (CONFIDENTIAL)'
  },
  {
    id: 'INV-3011',
    name: 'Inspector Sarah Lin',
    role: 'Chief Medical Examiner & Toxicology Lead',
    badgeId: 'BADGE-8820',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
    casesSolved: 176,
    activeCases: 5,
    clearanceLevel: 'LEVEL 5 (TOP SECRET)'
  }
];

export const mockCases: ForensicCase[] = [
  {
    id: 'FX-2026-1671',
    title: 'Operation Cipher Ghost: Harbor Penthouse Homicide',
    status: 'Forensic Testing',
    priority: 'CRITICAL',
    leadInvestigator: mockInvestigators[0], // Det. A. Sharma
    dateCreated: '2026-08-01',
    lastUpdated: '2026-08-05',
    incidentLocation: 'Skyline Plaza Penthouse B, District 4',
    description: 'Billionaire tech executive Julian Vance found deceased in locked study room. AI smart home security logs purged 12 minutes prior to estimated time of death. Traces of synthetic neurotoxin VX-7B and unverified DNA recovered.',
    evidenceCount: 14,
    aiConfidenceScore: 94.2,
    progressPercent: 78,
    victim: {
      id: 'VIC-8801',
      name: 'Julian Vance',
      age: 48,
      occupation: 'Founder & CEO, Quantum Cybernetics',
      status: 'Deceased - Confirmed',
      causeOfDeath: 'Acute Respiratory Paralysis via Synthetic VX-7B Neurotoxin',
      timeOfDeath: '2026-08-01 22:45 UTC',
      dnaMatchVerification: '99.98% CODIS Match on Swab #B-42 to Victor Vance',
      autopsySummary: 'Cranial contusion on left zygomatic arch, needle puncture mark adjacent to right carotid artery with VX-7B residue.'
    },
    cctvMatches: [
      {
        id: 'CCTV-01',
        timestamp: '22:38 PST',
        location: 'Skyline Tower Service Elevator',
        cameraName: 'CAM-NORTH-04',
        confidenceScore: 96.4,
        subjectDetected: 'Victor Vance (Hooded)',
        aiNotes: 'Facial biometric frame reconstruction matched suspect features despite low light and hood disguise.'
      },
      {
        id: 'CCTV-02',
        timestamp: '22:52 PST',
        location: 'Ground Floor Loading Dock Exit',
        cameraName: 'CAM-STREET-12',
        confidenceScore: 98.1,
        subjectDetected: 'Black Audi A8 (Reg: 9X22)',
        aiNotes: 'Automated License Plate Recognition (ALPR) confirmed suspect vehicle fleeing scene.'
      }
    ],
    phoneRecords: [
      {
        id: 'CDR-901',
        timestamp: '2026-08-01 23:15 PST',
        caller: '+1 (555) 019-2831 (V. Vance)',
        receiver: '+1 (555) 014-9920 (Broker X)',
        duration: '00:03:42',
        location: 'Harbor Bridge Cell Sector 3',
        encryptionStatus: 'Decrypted',
        flaggedByAi: true,
        transcriptSnippet: 'The drive has been extracted, cleanup complete. Initiate offshore escrow transfer.'
      },
      {
        id: 'CDR-902',
        timestamp: '2026-08-01 22:10 PST',
        caller: '+1 (555) 012-4411 (Julian Vance)',
        receiver: '+1 (555) 019-2831 (V. Vance)',
        duration: '00:01:15',
        location: 'Skyline Penthouse Wi-Fi Calling',
        encryptionStatus: 'Plaintext',
        flaggedByAi: true,
        transcriptSnippet: 'Do not step foot in this building, Victor. The board has voted to revoke your key.'
      }
    ],
    evidenceList: [
      {
        id: 'EVD-8801-01',
        caseId: 'CAS-2026-8801',
        caseTitle: 'Operation Cipher Ghost: Harbor Penthouse Homicide',
        title: 'Toxicology & Medical Examiner Autopsy Report',
        type: 'Autopsy',
        dateAdded: '2026-08-02 04:15 AM',
        fileSize: '48.2 MB',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        chainOfCustody: [
          { officer: 'Insp. Sarah Lin', timestamp: '2026-08-02 04:15 AM', action: 'Sample collection at scene' },
          { officer: 'Dr. Evelyn Vance', timestamp: '2026-08-02 09:30 AM', action: 'AI Spectral Gas Chromatography analysis' }
        ],
        summary: 'Autopsy reveals severe trauma to temporal bone and petechial hemorrhaging. Blood screening detected trace amounts of rare synthetic neurotoxin VX-7B.',
        aiInsights: 'AI detects 99.8% match with lab synthesized neurotoxins manufactured by Apex Pharma bio-labs.',
        details: {
          'Time of Death': '2026-08-01 22:45 UTC',
          'Primary Cause': 'Acute Respiratory Paralysis via Neurotoxin Injection',
          'Secondary Trauma': 'Blunt force trauma to left zygomatic arch',
          'Toxicology Status': 'POSITIVE (VX-7B - 4.2 µg/L)'
        }
      },
      {
        id: 'EVD-8801-02',
        caseId: 'CAS-2026-8801',
        caseTitle: 'Operation Cipher Ghost: Harbor Penthouse Homicide',
        title: 'High-Throughput DNA Sequencing Data (Swab #B-42)',
        type: 'DNA',
        dateAdded: '2026-08-02 11:20 AM',
        fileSize: '1.4 GB',
        sha256: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        chainOfCustody: [
          { officer: 'Det. David Reyes', timestamp: '2026-08-02 02:00 AM', action: 'Lifted touch DNA from study doorknob' },
          { officer: 'Dr. Evelyn Vance', timestamp: '2026-08-02 11:20 AM', action: 'Sequenced via Illumina NovaSeq' }
        ],
        summary: 'Partial epithelial cell DNA mixture recovered from door handle. Major component belongs to victim; minor component matches suspect Victor Vance.',
        aiInsights: 'AI STR analysis indicates 1 in 4.2 billion probability of matching Victor Vance.',
        details: {
          'Loci Evaluated': 24,
          'Mixture Ratio': '70% Victim / 30% Unknown Male',
          'CODIS Match': 'Victor Vance (CODIS #77921)'
        }
      },
      {
        id: 'EVD-8801-03',
        caseId: 'CAS-2026-8801',
        caseTitle: 'Operation Cipher Ghost: Harbor Penthouse Homicide',
        title: 'GPS Telemetry & Cell Tower Triangulation Log',
        type: 'GPS',
        dateAdded: '2026-08-03 08:00 AM',
        fileSize: '210.5 MB',
        sha256: 'b80a2b5314227f2c732c53043232c322d8f9a2b50d75a89871142203fbc12a01',
        chainOfCustody: [
          { officer: 'Agent Marcus Thorne', timestamp: '2026-08-03 08:00 AM', action: 'Subpoena extraction from Telecom Tower 409' }
        ],
        summary: 'Location ping history of suspect device (IMEI 359102941029) between 21:00 and 23:30 on date of homicide.',
        aiInsights: 'CRITICAL ANOMALY: Cell ping places suspect 120 meters from penthouse at 22:42, contradicting his stated alibi at Airport Terminal 2.',
        details: {
          'IMEI': '359102941029',
          'Target Carrier': 'Quantum Mobile',
          'Anomalous Window': '22:38 - 23:05 (Distance: 120m from crime scene)'
        }
      },
      {
        id: 'EVD-8801-04',
        caseId: 'CAS-2026-8801',
        caseTitle: 'Operation Cipher Ghost: Harbor Penthouse Homicide',
        title: 'Wiretap Audio Transcript & Voice Bio-Authentication',
        type: 'Audio/Transcript',
        dateAdded: '2026-08-03 02:45 PM',
        fileSize: '124.0 MB',
        sha256: 'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2',
        chainOfCustody: [
          { officer: 'Agent Marcus Thorne', timestamp: '2026-08-03 02:45 PM', action: 'Interception & AI Noise Suppression Filter' }
        ],
        summary: 'Encrypted call recording between suspect Victor Vance and unidentified broker at 23:15 PST.',
        aiInsights: 'Voice spectrograph confirms 98.4% biometric match with Victor Vance. Key phrase decoded: "The drive has been extracted, cleanup complete."',
        details: {
          'Duration': '00:03:42',
          'Acoustic Match': '98.4% Confidence',
          'Decrypted Keywords': 'Drive, Hex Key, Hex-0x9F'
        }
      }
    ],
    personsOfInterest: [
      {
        id: 'POI-101',
        name: 'Victor Vance',
        role: 'Suspect',
        threatLevel: 'Severe',
        alibiStatus: 'Conflicting',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        notes: 'Co-founder of Quantum Cyber. Stated he was boarding Flight QF-190 at time of murder. Cell tower logs contradict alibi.',
        dnaMatch: '99.98% Match on Swab #B-42'
      },
      {
        id: 'POI-102',
        name: 'Elena Rostova',
        role: 'Witness',
        threatLevel: 'Moderate',
        alibiStatus: 'Verified',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
        notes: 'Building security manager. Provided CCTV footage and reported seeing a hooded figure leave via service elevator at 22:52.'
      },
      {
        id: 'POI-103',
        name: 'Dr. Arthur Pendelton',
        role: 'Associate',
        threatLevel: 'Low',
        alibiStatus: 'Unverified',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
        notes: 'Head chemist at Apex Pharma bio-labs. Has access to VX-7B precursor compounds.'
      }
    ],
    timeline: [
      {
        id: 'TL-101',
        caseId: 'CAS-2026-8801',
        timestamp: '2026-08-01T21:30:00Z',
        timeDisplay: '21:30 PST',
        title: 'Victim Enters Study',
        description: 'Smart lock record shows victim unlocked penthouse study room. Security system arm status: ACTIVE.',
        category: 'Telecom',
        isAiFlagged: false,
        location: 'Skyline Penthouse - Room 402'
      },
      {
        id: 'TL-102',
        caseId: 'CAS-2026-8801',
        timestamp: '2026-08-01T22:33:00Z',
        timeDisplay: '22:33 PST',
        title: 'Smart Home Security Jammed',
        description: 'AI System detects sudden 2.4GHz & 5GHz RF frequency jam. CCTV streams freeze for 14 minutes.',
        category: 'Telecom',
        isAiFlagged: true,
        aiBreakthroughReason: 'AI correlation: RF Jamming signature matches Military Grade Deauth Device owned by Victor Vance.',
        confidenceScore: 96.8,
        location: 'Skyline Penthouse Outer Perimeter'
      },
      {
        id: 'TL-103',
        caseId: 'CAS-2026-8801',
        timestamp: '2026-08-01T22:42:00Z',
        timeDisplay: '22:42 PST',
        title: 'Suspect Cell Tower Ping',
        description: 'Victor Vance handset connects to Tower 409 antenna 3 facing Penthouse B.',
        category: 'GPS',
        isAiFlagged: true,
        aiBreakthroughReason: 'Contradicts suspect airport alibi by 22 miles.',
        confidenceScore: 99.4,
        associatedEvidenceId: 'EVD-8801-03',
        location: 'District 4 Telecom Cell #409'
      },
      {
        id: 'TL-104',
        caseId: 'CAS-2026-8801',
        timestamp: '2026-08-01T22:48:00Z',
        timeDisplay: '22:48 PST',
        title: 'Estimated Time of Fatal Subjugation',
        description: 'Autopsy indicates victim heart rate stopped. Injection trauma to neck area.',
        category: 'Autopsy',
        isAiFlagged: true,
        aiBreakthroughReason: 'VX-7B toxin rapidly incapacitated victim within 45 seconds.',
        confidenceScore: 98.1,
        associatedEvidenceId: 'EVD-8801-01',
        location: 'Study Desk'
      },
      {
        id: 'TL-105',
        caseId: 'CAS-2026-8801',
        timestamp: '2026-08-01T23:15:00Z',
        timeDisplay: '23:15 PST',
        title: 'Intercepted Encrypted Call',
        description: 'Wiretap captures voice call confirming drive extraction.',
        category: 'Witness',
        isAiFlagged: true,
        aiBreakthroughReason: 'Voice bio-spectrogram matches Victor Vance (98.4%).',
        associatedEvidenceId: 'EVD-8801-04',
        location: 'Harbor Bridge Expressway'
      }
    ],
    injuries: [
      {
        id: 'INJ-01',
        region: 'head',
        title: 'Left Temporal Contusion',
        type: 'Blunt Force Trauma',
        severity: 'Moderate',
        depth: '1.2 cm',
        description: 'Ecchymosis and scalp edema over left zygomatic arch. Pattern consistent with solid brass object.',
        estimatedTimeOfInjury: '22:40 PST (Pre-mortem)',
        aiNotes: 'Impression shape aligns with heavy metallic signet ring or heavy encryption key cylinder.',
        coordinates: { x: 48, y: 12 }
      },
      {
        id: 'INJ-02',
        region: 'neck',
        title: 'Puncture Trauma & Chemical Erythema',
        type: 'Toxic Chemical Residue',
        severity: 'Fatal',
        depth: '0.8 cm',
        description: 'Needle mark adjacent to right carotid artery. Micro-injection site containing VX-7B residue.',
        estimatedTimeOfInjury: '22:45 PST (Fatal event)',
        aiNotes: 'AI Toxin profiling: VX-7B organophosphate analog. Rapid neurological collapse.',
        coordinates: { x: 52, y: 22 }
      },
      {
        id: 'INJ-03',
        region: 'chest',
        title: 'Petechial Haemorrhage',
        type: 'Asphyxiation Mark',
        severity: 'Severe',
        depth: 'Surface',
        description: 'Widespread petechiae across upper thorax and pericardium indicating sudden respiratory asphyxia.',
        estimatedTimeOfInjury: '22:46 PST',
        aiNotes: 'Direct physiological consequence of cholinesterase inhibition from VX-7B.',
        coordinates: { x: 50, y: 35 }
      },
      {
        id: 'INJ-04',
        region: 'left_arm',
        title: 'Forearm Defense Lacerations',
        type: 'Defensive Wound',
        severity: 'Moderate',
        depth: '0.5 cm',
        description: 'Linear abrasions on left posterior forearm, indicating struggle against assailant.',
        estimatedTimeOfInjury: '22:41 PST',
        aiNotes: 'Epidermal tissue under victim fingernails contained swab #B-42 DNA mixture.',
        coordinates: { x: 38, y: 48 }
      }
    ],
    networkNodes: [
      { id: 'NODE-Vance', label: 'Victor Vance', sublabel: 'Prime Suspect', type: 'Suspect', x: 280, y: 150, threatLevel: 'Severe', color: '#ef4444' },
      { id: 'NODE-Victim', label: 'Julian Vance (Deceased)', sublabel: 'Tech CEO', type: 'Victim', x: 500, y: 280, threatLevel: 'Low', color: '#3b82f6' },
      { id: 'NODE-EvdDNA', label: 'Swab #B-42 DNA', sublabel: 'EVD-8801-02', type: 'Evidence', x: 380, y: 220, threatLevel: 'High', color: '#10b981' },
      { id: 'NODE-EvdTox', label: 'VX-7B Neurotoxin', sublabel: 'EVD-8801-01', type: 'Evidence', x: 620, y: 180, threatLevel: 'Severe', color: '#f59e0b' },
      { id: 'NODE-Tower', label: 'Cell Tower #409', sublabel: 'Telemetry Ping', type: 'Telecom', x: 180, y: 320, threatLevel: 'Medium', color: '#8b5cf6' },
      { id: 'NODE-Apex', label: 'Apex Bio-Labs', sublabel: 'Toxin Supplier', type: 'Location', x: 720, y: 320, threatLevel: 'High', color: '#ec4899' },
      { id: 'NODE-Car', label: 'Black Audi A8 (Reg: 9X22)', sublabel: 'Suspect Vehicle', type: 'Vehicle', x: 320, y: 420, threatLevel: 'High', color: '#06b6d4' }
    ],
    networkLinks: [
      { source: 'NODE-Vance', target: 'NODE-Victim', label: 'Motive / Disputed Patent', strength: 5, isSuspicious: true, notes: '$120M Equity Lawsuit pending' },
      { source: 'NODE-Vance', target: 'NODE-EvdDNA', label: 'DNA Match (99.98%)', strength: 5, isSuspicious: true, notes: 'Touch DNA on study doorknob' },
      { source: 'NODE-Vance', target: 'NODE-Tower', label: 'Cell Ping @ 22:42', strength: 4, isSuspicious: true, notes: 'Disproves airport alibi' },
      { source: 'NODE-EvdTox', target: 'NODE-Victim', label: 'Lethal Dose Injected', strength: 5, isSuspicious: true, notes: 'Cause of death' },
      { source: 'NODE-Apex', target: 'NODE-EvdTox', label: 'Batch #VX-99 Synthesis', strength: 4, isSuspicious: true, notes: 'Unregistered requisition' },
      { source: 'NODE-Vance', target: 'NODE-Car', label: 'Registered Owner', strength: 3, isSuspicious: false },
      { source: 'NODE-Car', target: 'NODE-Tower', label: 'LPR Camera Snapshot @ 22:39', strength: 4, isSuspicious: true, notes: 'License Plate Recognition hit' }
    ]
  },
  {
    id: 'CAS-2026-7492',
    title: 'Project Aegis: Central Bank SWIFT Ransomware Heist',
    status: 'Open',
    priority: 'HIGH',
    leadInvestigator: mockInvestigators[1],
    dateCreated: '2026-07-28',
    lastUpdated: '2026-08-04',
    incidentLocation: 'Central Financial Reserve Main Data Vault',
    description: 'Unauthorized access to wire transfer gateway. $42M in digital assets routed through mixer contracts. Zero-day exploit signature identified.',
    evidenceCount: 9,
    aiConfidenceScore: 88.7,
    evidenceList: [
      {
        id: 'EVD-7492-01',
        caseId: 'CAS-2026-7492',
        caseTitle: 'Project Aegis: Central Bank SWIFT Ransomware Heist',
        title: 'Core Switch Memory Dump & PCAP Packet Trace',
        type: 'Digital File',
        dateAdded: '2026-07-29 10:00 AM',
        fileSize: '12.8 GB',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        chainOfCustody: [
          { officer: 'Agent Marcus Thorne', timestamp: '2026-07-29 10:00 AM', action: 'Live memory capture' }
        ],
        summary: 'Volatility memory dump of infected gateway server showing active SSH tunnel to offshore C2 server.',
        aiInsights: 'Exploit uses modified EternalBlue variant combined with custom stolen private key.'
      }
    ],
    personsOfInterest: [
      {
        id: 'POI-201',
        name: 'Null_Byte (Handle)',
        role: 'Suspect',
        threatLevel: 'Severe',
        alibiStatus: 'None',
        notes: 'Darkweb broker affiliated with Lazarus Syndicate. Believed to reside in Eastern Europe.'
      }
    ],
    timeline: [],
    injuries: [],
    networkNodes: [],
    networkLinks: []
  },
  {
    id: 'CAS-2026-6110',
    title: 'PharmaTech Lab Bio-Contamination Sabotage',
    status: 'Forensic Testing',
    priority: 'HIGH',
    leadInvestigator: mockInvestigators[2],
    dateCreated: '2026-07-20',
    lastUpdated: '2026-08-03',
    incidentLocation: 'BioSafety Level 4 Facility, North Wing',
    description: 'Bacterial culture strain altered in automated bioreactor #3. Loss of $15M viral vaccine batch. HVAC telemetry indicates manual bypass.',
    evidenceCount: 11,
    aiConfidenceScore: 91.0,
    evidenceList: [],
    personsOfInterest: [],
    timeline: [],
    injuries: [],
    networkNodes: [],
    networkLinks: []
  },
  {
    id: 'CAS-2026-5012',
    title: 'Metro Transit System Automated Collision',
    status: 'Closed',
    priority: 'MEDIUM',
    leadInvestigator: mockInvestigators[3],
    dateCreated: '2026-06-15',
    lastUpdated: '2026-07-10',
    incidentLocation: 'Line 3 Underground Switch Yard',
    description: 'Autonomous train collision determined to be physical sensor masking rather than software override. Perpetrator convicted.',
    evidenceCount: 22,
    aiConfidenceScore: 99.1,
    evidenceList: [],
    personsOfInterest: [],
    timeline: [],
    injuries: [],
    networkNodes: [],
    networkLinks: []
  },
  {
    id: 'CAS-2026-4409',
    title: 'Autonomous Drone Swarm Airspace Intrusion',
    status: 'Under Review',
    priority: 'HIGH',
    leadInvestigator: mockInvestigators[1],
    dateCreated: '2026-08-03',
    lastUpdated: '2026-08-05',
    incidentLocation: 'Metropolitan Government Center',
    description: 'Seven unauthorized micro-drones intercepted hovering near classified communications array. Cryptographic firmware dumped.',
    evidenceCount: 6,
    aiConfidenceScore: 82.4,
    evidenceList: [],
    personsOfInterest: [],
    timeline: [],
    injuries: [],
    networkNodes: [],
    networkLinks: []
  }
];

export const mockMapIncidents: IncidentMapPoint[] = [
  {
    id: 'MAP-1',
    caseId: 'CAS-2026-8801',
    title: 'Harbor Penthouse Homicide',
    lat: 37.7749,
    lng: -122.4194,
    xPercent: 28,
    yPercent: 35,
    type: 'Homicide',
    severity: 'Critical',
    city: 'San Francisco, CA',
    timestamp: '2026-08-01 22:45'
  },
  {
    id: 'MAP-2',
    caseId: 'CAS-2026-7492',
    title: 'Central Bank Ransomware',
    lat: 40.7128,
    lng: -74.0060,
    xPercent: 78,
    yPercent: 32,
    type: 'Cyber',
    severity: 'High',
    city: 'New York, NY',
    timestamp: '2026-07-28 03:12'
  },
  {
    id: 'MAP-3',
    caseId: 'CAS-2026-6110',
    title: 'Bio-Lab Sabotage',
    lat: 41.8781,
    lng: -87.6298,
    xPercent: 62,
    yPercent: 38,
    type: 'Arson',
    severity: 'High',
    city: 'Chicago, IL',
    timestamp: '2026-07-20 14:00'
  },
  {
    id: 'MAP-4',
    caseId: 'CAS-2026-4409',
    title: 'Government Center Drone Intrusion',
    lat: 38.9072,
    lng: -77.0369,
    xPercent: 74,
    yPercent: 44,
    type: 'Cyber',
    severity: 'Critical',
    city: 'Washington, D.C.',
    timestamp: '2026-08-03 19:20'
  },
  {
    id: 'MAP-5',
    caseId: 'CAS-2026-9011',
    title: 'Cartel Cryptographic Wallet Intercept',
    lat: 25.7617,
    lng: -80.1918,
    xPercent: 72,
    yPercent: 76,
    type: 'Narcotics',
    severity: 'Medium',
    city: 'Miami, FL',
    timestamp: '2026-08-04 11:05'
  },
  {
    id: 'MAP-6',
    caseId: 'CAS-2026-3392',
    title: 'Port Cargo Container Contraband',
    lat: 47.6062,
    lng: -122.3321,
    xPercent: 24,
    yPercent: 18,
    type: 'Narcotics',
    severity: 'High',
    city: 'Seattle, WA',
    timestamp: '2026-08-02 08:30'
  }
];

export const mockSystemAlerts: SystemAlert[] = [
  {
    id: 'ALT-901',
    timestamp: '12 mins ago',
    title: 'AI Correlation Breakthrough',
    message: 'DNA swab #B-42 matches CODIS record for suspect Victor Vance with 99.98% certainty.',
    caseId: 'CAS-2026-8801',
    severity: 'critical'
  },
  {
    id: 'ALT-902',
    timestamp: '45 mins ago',
    title: 'GPS Alibi Anomaly Detected',
    message: 'Cell tower #409 log contradicts suspect statement by 22 miles during crime window.',
    caseId: 'CAS-2026-8801',
    severity: 'warning'
  },
  {
    id: 'ALT-903',
    timestamp: '2 hours ago',
    title: 'Chain-of-Custody Integrity Verified',
    message: 'SHA-256 hash check passed for 14 primary digital evidence files.',
    caseId: 'CAS-2026-7492',
    severity: 'info'
  },
  {
    id: 'ALT-904',
    timestamp: '5 hours ago',
    title: 'New Telemetry Dump Received',
    message: '6.4 GB of blackbox flight recorder telemetry parsed for Drone Intrusion case.',
    caseId: 'CAS-2026-4409',
    severity: 'info'
  }
];

export const mockGlobalEvidence: EvidenceItem[] = [
  ...mockCases[0].evidenceList,
  {
    id: 'EVD-7492-02',
    caseId: 'CAS-2026-7492',
    caseTitle: 'Project Aegis: SWIFT Ransomware Heist',
    title: 'SWIFT Gateway Server Kernel Dump',
    type: 'Digital File',
    dateAdded: '2026-07-29',
    fileSize: '4.2 GB',
    sha256: 'd1901a1c93a8e94998822002130e9f1a238b',
    chainOfCustody: [{ officer: 'Agent Marcus Thorne', timestamp: '2026-07-29', action: 'Injected RAM Dump' }],
    summary: 'Captured encrypted payload targeting SWIFT MT103 wire messages.',
    aiInsights: 'Zero-day exploit payload decompiled to 4096-bit RSA private key signature.'
  },
  {
    id: 'EVD-6110-01',
    caseId: 'CAS-2026-6110',
    caseTitle: 'PharmaTech Lab Bio-Contamination',
    title: 'Bioreactor Spectrogram & Chemical Assay',
    type: 'Chemical/Tox',
    dateAdded: '2026-07-21',
    fileSize: '890 MB',
    sha256: 'f892a019b84c7d659a2feaa0c55ad015',
    chainOfCustody: [{ officer: 'Insp. Sarah Lin', timestamp: '2026-07-21', action: 'Assay analysis' }],
    summary: 'Assay confirms insertion of engineered bacteriophage targeting vaccine strain.',
    aiInsights: 'Phage modification signature matches synthetic genetics patent #US-2025-0091.'
  },
  {
    id: 'EVD-4409-01',
    caseId: 'CAS-2026-4409',
    caseTitle: 'Autonomous Drone Swarm Airspace Intrusion',
    title: 'Intercepted Micro-Drone Flight Controller Memory',
    type: 'GPS',
    dateAdded: '2026-08-03',
    fileSize: '650 MB',
    sha256: '9a102910390192830192830192830192',
    chainOfCustody: [{ officer: 'Agent Marcus Thorne', timestamp: '2026-08-03', action: 'Firmware extraction' }],
    summary: 'Waypoints extracted showing launch origin from unregistered vessel in Bay Area.',
    aiInsights: 'GPS waypoints trace launch spot to container vessel "MV Northern Star".'
  }
];
