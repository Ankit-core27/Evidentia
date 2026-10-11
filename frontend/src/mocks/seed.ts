// Seed data for mock mode: the MVP road-accident case and three smaller cases.
// The backend's seed.py should load the same case, so screens look the same
// when mocks are switched off.
import { EvidenceType, Id, RecordType } from '@/types/api';
import { addAudit, chunkFor, chunkText, MockDb, StoredEvidence } from './db';
import { makePdf, makeScenePhoto, makeText, makeWav, sha256Hex } from './files';

/** Local time on a given day in IST, as an ISO string. */
const at = (day: string, time: string) => `2026-${day}T${time}+05:30`;
const oct3 = (time: string) => at('10-03', time);

// ---------------------------------------------------------------------------
// Evidence texts for case 1
// ---------------------------------------------------------------------------

const POLICE_REPORT = [
  `TRAFFIC POLICE - SECTOR 12 STATION
Accident report no. TPS12/2026/0412

Date and time of incident: 3 October 2026, about 21:40. Location: junction of Ring Road and 5th Avenue, Sector 12.

Vehicle 1: white Maruti Swift hatchback, KA-01-AB-1234, driven by Rohan Kapoor (34), travelling east on Ring Road.

Vehicle 2: blue Tata Ace delivery van, KA-05-CD-5678, driven by Suresh Nair (46), travelling north on 5th Avenue, registered to QuickCart Logistics.

The van struck the driver's side of the hatchback in the middle of the junction. The hatchback came to rest against the north-east kerb. The van stopped near the centre line of 5th Avenue.

Rohan Kapoor was taken to City General Hospital by ambulance at 21:52 with a shoulder injury and a cut to the forehead. Suresh Nair was not injured.`,
  `Statements at the scene:

Suresh Nair stated that he waited at the stop line and moved off when his light went green. His phone was in a dashboard mount and he says he was not using it.

Rohan Kapoor stated that his light was amber when he entered the junction.

Scene examination at 23:10: skid marks from the hatchback measured 8.4 m before the point of impact. The van left no skid marks. Signal heads on all four arms were working. The signal controller log has been requested from the traffic management centre.

Witnesses: Anita Desai (pedestrian, north-east corner) and Vikram Singh (shopkeeper, south-west corner). CCTV from junction camera 2 seized.`
];

const DESAI_STATEMENT = `Witness statement - Anita Desai
Recorded by SI Arjun Mehta, 3 October 2026, 22:30, at the scene.

I was waiting to cross 5th Avenue at the north-east corner of the junction. The pedestrian signal for my crossing was red.

The white car was coming along Ring Road from the west. Its light was still yellow when it went into the junction. I am sure of that because I was watching the lights to see when I could cross.

The blue delivery van on 5th Avenue started moving before its light turned green. It had been creeping forward over the line, and it went as soon as the car's light changed. It hit the side of the white car in the middle of the junction.

I called 112 straight away. A man on a bicycle was also waiting at the corner, but he rode off before the police came.`;

const SINGH_STATEMENT = `Witness statement - Vikram Singh
Recorded by SI Arjun Mehta, 3 October 2026, 22:45, at his shop.

I run the corner store on the south-west corner of the junction. I was standing at the shop door, facing the junction.

The white car came fast along Ring Road. The light for Ring Road was red before the car reached the junction, and it did not slow down.

The delivery van had a green light. It pulled away normally from the stop line and the car went straight across in front of it. The van could not stop in time.

I have seen many cars jump that light at night.`;

const CCTV_DESCRIPTION = `Junction camera 2, facing north along 5th Avenue. Recording from 21:38:00 to 21:42:00. The signal heads are outside the camera's view. The camera clock has not yet been checked against the signal controller clock.

21:39:48 The blue delivery van arrives at the 5th Avenue stop line and stops.

21:40:06 The van's front wheels move about one metre past the stop line.

21:40:10 The white hatchback enters the frame from the left on Ring Road, travelling east.

21:40:11 The van moves off into the junction.

21:40:12 The van strikes the driver's side of the hatchback near the centre of the junction.

21:40:20 A cyclist at the north-east corner rides away north along 5th Avenue.

21:40:35 A pedestrian at the north-east corner makes a phone call.`;

const CALL_TRANSCRIPT = `Emergency call to 112, 3 October 2026, 21:41:05. Duration 1 minute 12 seconds.

Caller (Anita Desai): There's been an accident at the Ring Road and 5th Avenue junction. A van has hit a car.

Operator: Is anyone hurt?

Caller: The driver of the car is hurt, he's holding his shoulder. There's blood on his face.

Operator: An ambulance is on its way. Is the road blocked?

Caller: Yes, both of them are in the middle of the junction.`;

const MEDICAL_REPORT = [
  `CITY GENERAL HOSPITAL - EMERGENCY DEPARTMENT

Patient: Rohan Kapoor, male, 34. Arrived 3 October 2026, 22:05, by ambulance.

Finding 1: displaced fracture of the right clavicle, consistent with a side impact on the driver's side.

Finding 2: laceration of the forehead, 3 cm, sutured.

Finding 3: bruising to the right upper arm.

Blood alcohol: not detected. Condition: stable, admitted for observation.

Examining doctor: Dr. Kavya Iyer`
];

const SIGNAL_LOG = `Traffic management centre - signal controller log
Junction: Ring Road / 5th Avenue (controller J-12-04). Date: 3 October 2026.

21:39:20 Ring Road green, 5th Avenue red.

21:40:08 Ring Road amber, 5th Avenue red.

21:40:11 Ring Road red, 5th Avenue red (all-red phase).

21:40:13 Ring Road red, 5th Avenue green.

21:41:03 Ring Road red, 5th Avenue amber.

No faults were recorded between 21:00 and 22:00.`;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface EvidenceSeed {
  id: Id;
  case_id: Id;
  type: EvidenceType;
  title: string;
  description: string;
  source: string;
  collected_at: string;
  file: Blob | null;
  /** Used when there is no generated file (the CCTV clip). */
  size_bytes?: number;
  mime_type?: string;
  text: string | null;
  pages?: string[];
  summary: string;
}

export const buildSeed = async (): Promise<MockDb> => {
  const db: MockDb = {
    investigators: [
      { id: 1, name: 'Insp. Meera Rao', badge_number: 'TPD-2187', role: 'Lead Investigator', clearance_level: 'Level 4' },
      {
        id: 2,
        name: 'SI Arjun Mehta',
        badge_number: 'TPD-3044',
        role: 'Accident Reconstruction Specialist',
        clearance_level: 'Level 3'
      },
      { id: 3, name: 'Dr. Kavya Iyer', badge_number: 'FMO-0912', role: 'Forensic Medical Officer', clearance_level: 'Level 3' },
      { id: 4, name: 'Const. Rahul Verma', badge_number: 'TPD-4410', role: 'Evidence Officer', clearance_level: 'Level 2' }
    ],
    cases: [
      {
        id: 1,
        case_number: 'FX-2026-0001',
        title: 'Collision at Ring Road and 5th Avenue junction',
        incident_type: 'road_accident',
        status: 'in_progress',
        priority: 'high',
        description:
          'A delivery van and a hatchback collided in a signal-controlled junction at about 21:40. The hatchback driver was injured. Witnesses disagree on which vehicle had the right of way.',
        incident_at: oct3('21:40:12'),
        lead_investigator_id: 1,
        investigator_ids: [1, 2, 3, 4],
        created_at: oct3('22:10:00'),
        updated_at: at('10-05', '11:20:00')
      },
      {
        id: 2,
        case_number: 'FX-2026-0002',
        title: 'Hit-and-run on Lakeview Road',
        incident_type: 'road_accident',
        status: 'open',
        priority: 'critical',
        description: 'A pedestrian was struck near bus stop 14 by a vehicle that did not stop.',
        incident_at: at('10-07', '23:15:00'),
        lead_investigator_id: 2,
        investigator_ids: [2, 4],
        created_at: at('10-08', '00:05:00'),
        updated_at: at('10-08', '09:40:00')
      },
      {
        id: 3,
        case_number: 'FX-2026-0003',
        title: 'Warehouse fire, Industrial Area Phase 2',
        incident_type: 'fire',
        status: 'under_review',
        priority: 'medium',
        description: 'Fire in a textile warehouse during the night shift. Cause under review.',
        incident_at: at('09-21', '03:20:00'),
        lead_investigator_id: 3,
        investigator_ids: [3],
        created_at: at('09-21', '06:00:00'),
        updated_at: at('09-30', '15:00:00')
      },
      {
        id: 4,
        case_number: 'FX-2026-0004',
        title: 'Burglary at Greenpark Apartments, flat 4B',
        incident_type: 'burglary',
        status: 'closed',
        priority: 'low',
        description: 'Daytime burglary while the residents were away. Property recovered.',
        incident_at: at('08-30', '14:00:00'),
        lead_investigator_id: 1,
        investigator_ids: [1, 4],
        created_at: at('08-30', '18:00:00'),
        updated_at: at('09-12', '10:00:00')
      }
    ],
    evidence: [],
    chunks: [],
    links: [],
    persons: [],
    objects: [],
    locations: [],
    events: [],
    relationships: [],
    observations: [],
    conflicts: [],
    injuries: [],
    anatomyFindings: [],
    reconstructions: [],
    stages: [],
    sceneObjects: [],
    annotations: [],
    reports: [],
    audit: [],
    files: new Map(),
    processedAt: new Map()
  };

  // -------------------------------------------------------------------------
  // Evidence
  // -------------------------------------------------------------------------

  const evidenceSeeds: EvidenceSeed[] = [
    {
      id: 1,
      case_id: 1,
      type: 'document',
      title: 'Police accident report TPS12/2026/0412',
      description: 'Report by the first officers at the scene, with statements and scene examination.',
      source: 'Traffic Police, Sector 12 station',
      collected_at: oct3('23:40:00'),
      file: makePdf(POLICE_REPORT),
      text: POLICE_REPORT.join('\n\n'),
      pages: POLICE_REPORT,
      summary:
        'Van struck the driver side of the hatchback in the junction at about 21:40. Hatchback driver injured. Hatchback skid marks 8.4 m. Van driver says he moved off on green; hatchback driver says his light was amber.'
    },
    {
      id: 2,
      case_id: 1,
      type: 'statement',
      title: 'Witness statement: Anita Desai',
      description: 'Pedestrian waiting at the north-east corner.',
      source: 'Recorded by SI Arjun Mehta',
      collected_at: oct3('22:30:00'),
      file: makeText(DESAI_STATEMENT),
      text: DESAI_STATEMENT,
      summary:
        "Says the hatchback entered on yellow and the van moved off before its light turned green. Called 112. Mentions a cyclist who left before police arrived."
    },
    {
      id: 3,
      case_id: 1,
      type: 'statement',
      title: 'Witness statement: Vikram Singh',
      description: 'Shopkeeper at the south-west corner.',
      source: 'Recorded by SI Arjun Mehta',
      collected_at: oct3('22:45:00'),
      file: makeText(SINGH_STATEMENT),
      text: SINGH_STATEMENT,
      summary: 'Says the hatchback ran a red light at speed and the van pulled away on green.'
    },
    {
      id: 4,
      case_id: 1,
      type: 'video',
      title: 'Junction camera 2, 21:38 to 21:42',
      description: 'CCTV facing north along 5th Avenue. Signal heads not in view.',
      source: 'Traffic management centre',
      collected_at: oct3('23:55:00'),
      file: null,
      size_bytes: 48_234_112,
      mime_type: 'video/mp4',
      text: CCTV_DESCRIPTION,
      summary:
        'Van creeps past the stop line at 21:40:06, moves off at 21:40:11 and strikes the hatchback at 21:40:12. A cyclist leaves the scene at 21:40:20. Camera clock not yet checked.'
    },
    {
      id: 5,
      case_id: 1,
      type: 'photo',
      title: 'Scene photo: hatchback at rest',
      description: 'Hatchback against the north-east kerb, driver-side damage.',
      source: 'Const. Rahul Verma',
      collected_at: oct3('23:10:00'),
      file: makeScenePhoto('Scene photo 1: hatchback at rest, NE kerb'),
      text: null,
      summary: 'Hatchback at rest against the north-east kerb with damage to the driver door and B-pillar.'
    },
    {
      id: 6,
      case_id: 1,
      type: 'audio',
      title: 'Emergency call recording (112)',
      description: 'Call made by Anita Desai at 21:41.',
      source: 'Emergency response centre',
      collected_at: at('10-04', '10:00:00'),
      file: makeWav(),
      text: CALL_TRANSCRIPT,
      summary: 'Anita Desai reports a van hitting a car at 21:41; the car driver is hurt and the junction is blocked.'
    },
    {
      id: 7,
      case_id: 1,
      type: 'medical',
      title: 'Medical report: Rohan Kapoor',
      description: 'Emergency department findings, City General Hospital.',
      source: 'City General Hospital',
      collected_at: at('10-04', '09:00:00'),
      file: makePdf(MEDICAL_REPORT),
      text: MEDICAL_REPORT.join('\n\n'),
      pages: MEDICAL_REPORT,
      summary: 'Fractured right clavicle, 3 cm forehead laceration, bruised right upper arm. No alcohol detected.'
    },
    {
      id: 8,
      case_id: 1,
      type: 'document',
      title: 'Signal controller log, junction J-12-04',
      description: 'Signal phase changes between 21:39 and 21:41.',
      source: 'Traffic management centre',
      collected_at: at('10-04', '16:30:00'),
      file: makeText(SIGNAL_LOG),
      text: SIGNAL_LOG,
      summary: 'Ring Road amber 21:40:08, red 21:40:11; all-red until 5th Avenue turns green at 21:40:13. No faults.'
    },
    {
      id: 9,
      case_id: 2,
      type: 'photo',
      title: 'Bus stop 14 camera still',
      description: 'Still frame from the bus shelter camera.',
      source: 'City transport authority',
      collected_at: at('10-08', '08:00:00'),
      file: makeScenePhoto('Bus stop 14 camera, 23:15'),
      text: null,
      summary: 'Dark hatchback with a damaged left headlight passing the bus stop at 23:15.'
    },
    {
      id: 10,
      case_id: 2,
      type: 'statement',
      title: 'Witness statement: bus driver',
      description: 'Driver of route 220, parked at bus stop 14.',
      source: 'Recorded by SI Arjun Mehta',
      collected_at: at('10-08', '01:10:00'),
      file: makeText(
        'Witness statement - route 220 bus driver\n\nA dark hatchback hit a man crossing behind my bus at about 23:15. It did not stop and drove towards Lakeview Circle.'
      ),
      text: 'Witness statement - route 220 bus driver\n\nA dark hatchback hit a man crossing behind my bus at about 23:15. It did not stop and drove towards Lakeview Circle.',
      summary: 'Dark hatchback hit a pedestrian at about 23:15 and drove towards Lakeview Circle.'
    },
    {
      id: 11,
      case_id: 3,
      type: 'document',
      title: 'Fire service incident report',
      description: 'Report from the attending fire station.',
      source: 'Fire station 7',
      collected_at: at('09-22', '12:00:00'),
      file: makePdf([
        'FIRE SERVICE INCIDENT REPORT\n\nFire reported at 03:20 in a textile warehouse. Fire started near the electrical panel on the ground floor. No injuries.'
      ]),
      text: 'FIRE SERVICE INCIDENT REPORT\n\nFire reported at 03:20 in a textile warehouse. Fire started near the electrical panel on the ground floor. No injuries.',
      pages: [
        'FIRE SERVICE INCIDENT REPORT\n\nFire reported at 03:20 in a textile warehouse. Fire started near the electrical panel on the ground floor. No injuries.'
      ],
      summary: 'Fire started near the ground-floor electrical panel at about 03:20. No injuries.'
    },
    {
      id: 12,
      case_id: 4,
      type: 'statement',
      title: 'Complainant statement',
      description: 'Resident of flat 4B.',
      source: 'Recorded by Insp. Meera Rao',
      collected_at: at('08-30', '18:30:00'),
      file: makeText('Complainant statement\n\nWe returned at 17:30 to find the balcony door forced and jewellery missing.'),
      text: 'Complainant statement\n\nWe returned at 17:30 to find the balcony door forced and jewellery missing.',
      summary: 'Balcony door forced; jewellery missing. Discovered at 17:30.'
    }
  ];

  for (const seed of evidenceSeeds) {
    const row: StoredEvidence = {
      id: seed.id,
      case_id: seed.case_id,
      type: seed.type,
      title: seed.title,
      description: seed.description,
      notes: '',
      mime_type: seed.file?.type ?? seed.mime_type ?? 'application/octet-stream',
      size_bytes: seed.file?.size ?? seed.size_bytes ?? 0,
      sha256: seed.file
        ? await sha256Hex(seed.file)
        : await sha256Hex(makeText(`${seed.title}\n${seed.text ?? ''}`)),
      collected_at: seed.collected_at,
      source: seed.source,
      processing_status: 'done',
      summary: seed.summary,
      created_at: seed.collected_at,
      extracted_text: seed.text
    };
    db.evidence.push(row);
    if (seed.file) db.files.set(seed.id, seed.file);
    if (seed.text) chunkText(db, seed.id, seed.text, seed.pages);
    addAudit(db, 4, 'uploaded', 'evidence', seed.id, { title: seed.title }, seed.collected_at);
  }

  // -------------------------------------------------------------------------
  // Persons, objects and locations
  // -------------------------------------------------------------------------

  const investigator = { origin: 'investigator', review_status: 'confirmed' } as const;
  const aiPending = { origin: 'ai', review_status: 'pending' } as const;
  const aiConfirmed = { origin: 'ai', review_status: 'confirmed' } as const;

  db.persons.push(
    {
      id: 1,
      case_id: 1,
      role: 'victim',
      name: 'Rohan Kapoor',
      age: 34,
      occupation: 'Software engineer',
      condition: 'injured',
      contact: '+91 90000 00101',
      notes: 'Driver of the hatchback. Says his light was amber when he entered the junction.',
      details: {},
      ...investigator
    },
    {
      id: 2,
      case_id: 1,
      role: 'other',
      name: 'Suresh Nair',
      age: 46,
      occupation: 'Delivery driver, QuickCart Logistics',
      condition: 'uninjured',
      contact: '+91 90000 00102',
      notes: 'Driver of the van. Says he moved off when his light went green.',
      details: {},
      ...investigator
    },
    {
      id: 3,
      case_id: 1,
      role: 'witness',
      name: 'Anita Desai',
      age: 29,
      occupation: 'Pedestrian at the north-east corner',
      condition: 'uninjured',
      contact: '+91 90000 00103',
      notes: 'Watched the signals while waiting to cross. Called 112.',
      details: {},
      ...investigator
    },
    {
      id: 4,
      case_id: 1,
      role: 'witness',
      name: 'Vikram Singh',
      age: 52,
      occupation: 'Shopkeeper, south-west corner',
      condition: 'uninjured',
      contact: '+91 90000 00104',
      notes: 'Watched from his shop door.',
      details: {},
      ...investigator
    },
    {
      id: 5,
      case_id: 1,
      role: 'witness',
      name: 'Unidentified cyclist',
      age: null,
      occupation: '',
      condition: null,
      contact: '',
      notes: 'Waiting at the north-east corner; rode away north before the police arrived.',
      details: {},
      ...aiPending
    },
    {
      id: 6,
      case_id: 2,
      role: 'victim',
      name: 'Unidentified pedestrian',
      age: 60,
      occupation: '',
      condition: 'injured',
      contact: '',
      notes: 'Struck while crossing behind the route 220 bus.',
      details: {},
      ...investigator
    }
  );

  db.objects.push(
    {
      id: 1,
      case_id: 1,
      kind: 'vehicle',
      label: 'White hatchback',
      details: { plate: 'KA-01-AB-1234', make: 'Maruti Swift', colour: 'White' },
      ...investigator
    },
    {
      id: 2,
      case_id: 1,
      kind: 'vehicle',
      label: 'Delivery van',
      details: { plate: 'KA-05-CD-5678', make: 'Tata Ace', colour: 'Blue' },
      ...investigator
    },
    {
      id: 3,
      case_id: 1,
      kind: 'phone',
      label: "Van driver's phone",
      details: { number: '+91 90000 00102' },
      ...aiPending
    },
    {
      id: 4,
      case_id: 2,
      kind: 'vehicle',
      label: 'Dark hatchback (unidentified)',
      details: { colour: 'Dark grey' },
      ...investigator
    }
  );

  db.locations.push(
    { id: 1, case_id: 1, kind: 'incident_site', address: 'Ring Road and 5th Avenue junction, Sector 12', lat: 12.9716, lng: 77.5946, geometry: null, building_id: null, ...investigator },
    { id: 2, case_id: 1, kind: 'witness_position', address: 'North-east corner, pedestrian crossing', lat: 12.97175, lng: 77.59475, geometry: null, building_id: null, ...investigator },
    { id: 3, case_id: 1, kind: 'witness_position', address: 'Corner store, south-west corner', lat: 12.97145, lng: 77.59445, geometry: null, building_id: null, ...investigator },
    { id: 4, case_id: 1, kind: 'vehicle_position', address: 'Hatchback rest position, north-east kerb', lat: 12.97168, lng: 77.59472, geometry: null, building_id: null, ...investigator },
    { id: 5, case_id: 1, kind: 'vehicle_position', address: 'Van rest position, 5th Avenue centre line', lat: 12.97158, lng: 77.59458, geometry: null, building_id: null, ...investigator },
    { id: 6, case_id: 2, kind: 'incident_site', address: 'Lakeview Road near bus stop 14', lat: 12.9352, lng: 77.6245, geometry: null, building_id: null, ...investigator },
    { id: 7, case_id: 3, kind: 'incident_site', address: 'Plot 22, Industrial Area Phase 2', lat: 13.0158, lng: 77.5367, geometry: null, building_id: null, ...investigator },
    { id: 8, case_id: 4, kind: 'incident_site', address: 'Greenpark Apartments, flat 4B', lat: 12.9279, lng: 77.6271, geometry: null, building_id: null, ...investigator }
  );

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------

  db.events.push(
    { id: 1, case_id: 1, location_id: null, category: 'movement', time_start: oct3('21:39:00'), time_end: oct3('21:40:10'), time_precision: 'approximate', certainty: 'established', description: 'Hatchback travels east on Ring Road towards the junction', ai_note: null, ...investigator },
    { id: 2, case_id: 1, location_id: 1, category: 'movement', time_start: oct3('21:39:48'), time_end: null, time_precision: 'exact', certainty: 'established', description: 'Van stops at the 5th Avenue stop line', ai_note: null, ...aiConfirmed },
    { id: 3, case_id: 1, location_id: 1, category: 'movement', time_start: oct3('21:40:06'), time_end: null, time_precision: 'exact', certainty: 'established', description: 'Van creeps about one metre past the stop line', ai_note: null, ...aiConfirmed },
    { id: 4, case_id: 1, location_id: 1, category: 'other', time_start: oct3('21:40:08'), time_end: null, time_precision: 'exact', certainty: 'established', description: 'Ring Road signal turns amber', ai_note: null, ...investigator },
    { id: 5, case_id: 1, location_id: 1, category: 'other', time_start: oct3('21:40:11'), time_end: null, time_precision: 'exact', certainty: 'established', description: 'Ring Road signal turns red; all-red phase begins', ai_note: null, ...investigator },
    { id: 6, case_id: 1, location_id: 1, category: 'movement', time_start: oct3('21:40:11'), time_end: null, time_precision: 'exact', certainty: 'disputed', description: 'Van moves off into the junction', ai_note: "Camera time is before 5th Avenue's green at 21:40:13, matching Anita Desai. Vikram Singh says the van had green. The camera clock has not been checked.", ...aiPending },
    { id: 7, case_id: 1, location_id: 1, category: 'collision', time_start: oct3('21:40:12'), time_end: null, time_precision: 'exact', certainty: 'established', description: "Van strikes the driver's side of the hatchback", ai_note: null, ...investigator },
    { id: 8, case_id: 1, location_id: 1, category: 'other', time_start: oct3('21:40:13'), time_end: null, time_precision: 'exact', certainty: 'established', description: '5th Avenue signal turns green', ai_note: null, ...investigator },
    { id: 9, case_id: 1, location_id: 2, category: 'witness', time_start: oct3('21:40:20'), time_end: null, time_precision: 'exact', certainty: 'hypothesis', description: 'Unidentified cyclist leaves the scene northbound', ai_note: 'Seen on camera 2 and mentioned by Anita Desai. A possible third witness.', ...aiPending },
    { id: 10, case_id: 1, location_id: 2, category: 'emergency', time_start: oct3('21:41:05'), time_end: null, time_precision: 'exact', certainty: 'established', description: 'Anita Desai calls 112', ai_note: null, ...investigator },
    { id: 11, case_id: 1, location_id: 1, category: 'emergency', time_start: oct3('21:52:00'), time_end: null, time_precision: 'minute', certainty: 'established', description: 'Ambulance takes Rohan Kapoor to City General Hospital', ai_note: null, ...investigator },
    { id: 12, case_id: 1, location_id: null, category: 'medical', time_start: oct3('22:05:00'), time_end: null, time_precision: 'minute', certainty: 'established', description: 'Rohan Kapoor examined at City General Hospital', ai_note: null, ...investigator },
    { id: 13, case_id: 1, location_id: 1, category: 'investigation', time_start: oct3('23:10:00'), time_end: null, time_precision: 'minute', certainty: 'established', description: 'Scene examined; hatchback skid marks of 8.4 m measured', ai_note: null, ...investigator },
    { id: 14, case_id: 2, location_id: 6, category: 'collision', time_start: at('10-07', '23:15:00'), time_end: null, time_precision: 'approximate', certainty: 'established', description: 'Pedestrian struck behind the route 220 bus', ai_note: null, ...investigator }
  );

  // -------------------------------------------------------------------------
  // Relationships
  // -------------------------------------------------------------------------

  db.relationships.push(
    { id: 1, case_id: 1, from_type: 'person', from_id: 1, to_type: 'object', to_id: 1, kind: 'drove', label: 'Driver', confidence: null, flagged: false, notes: '', ...investigator },
    { id: 2, case_id: 1, from_type: 'person', from_id: 2, to_type: 'object', to_id: 2, kind: 'drove', label: 'Driver', confidence: null, flagged: false, notes: '', ...investigator },
    { id: 3, case_id: 1, from_type: 'object', from_id: 1, to_type: 'location', to_id: 1, kind: 'involved_in', label: 'Struck in junction', confidence: null, flagged: false, notes: '', ...investigator },
    { id: 4, case_id: 1, from_type: 'object', from_id: 2, to_type: 'location', to_id: 1, kind: 'involved_in', label: 'Struck the hatchback', confidence: null, flagged: false, notes: '', ...investigator },
    { id: 5, case_id: 1, from_type: 'person', from_id: 3, to_type: 'location', to_id: 1, kind: 'witnessed', label: 'Watched from NE crossing', confidence: null, flagged: false, notes: '', ...investigator },
    { id: 6, case_id: 1, from_type: 'person', from_id: 4, to_type: 'location', to_id: 1, kind: 'witnessed', label: 'Watched from shop door', confidence: null, flagged: false, notes: '', ...investigator },
    { id: 7, case_id: 1, from_type: 'evidence', from_id: 2, to_type: 'evidence', to_id: 3, kind: 'contradicts', label: 'Disagree on signal colour', confidence: 0.92, flagged: true, notes: 'Desai: hatchback on yellow, van early. Singh: hatchback on red, van on green.', ...aiPending },
    { id: 8, case_id: 1, from_type: 'evidence', from_id: 4, to_type: 'object', to_id: 2, kind: 'mentions', label: 'Van moves off at 21:40:11', confidence: 0.88, flagged: false, notes: '', ...aiConfirmed },
    { id: 9, case_id: 1, from_type: 'person', from_id: 2, to_type: 'object', to_id: 3, kind: 'owns', label: 'Phone in dashboard mount', confidence: 0.75, flagged: false, notes: '', ...aiPending },
    { id: 10, case_id: 1, from_type: 'evidence', from_id: 8, to_type: 'evidence', to_id: 2, kind: 'supports', label: 'Signal log fits amber entry', confidence: 0.7, flagged: false, notes: '', ...aiPending },
    { id: 11, case_id: 1, from_type: 'person', from_id: 5, to_type: 'location', to_id: 1, kind: 'witnessed', label: 'Left before police arrived', confidence: 0.6, flagged: true, notes: '', ...aiPending },
    { id: 12, case_id: 2, from_type: 'object', from_id: 4, to_type: 'person', to_id: 6, kind: 'involved_in', label: 'Struck pedestrian', confidence: null, flagged: false, notes: '', ...investigator }
  );

  // -------------------------------------------------------------------------
  // Observations and conflicts
  // -------------------------------------------------------------------------

  db.observations.push(
    { id: 1, case_id: 1, subject_type: 'object', subject_id: 1, statement: "The hatchback's signal was amber when it entered the junction.", observed_at: oct3('21:40:10'), author_id: null, ...aiPending },
    { id: 2, case_id: 1, subject_type: 'object', subject_id: 1, statement: "The hatchback's signal was red before it reached the junction.", observed_at: oct3('21:40:10'), author_id: null, ...aiPending },
    { id: 3, case_id: 1, subject_type: 'object', subject_id: 2, statement: 'The van moved off before its signal turned green.', observed_at: oct3('21:40:11'), author_id: null, ...aiPending },
    { id: 4, case_id: 1, subject_type: 'object', subject_id: 2, statement: 'The van had a green signal when it pulled away.', observed_at: oct3('21:40:11'), author_id: null, ...aiPending },
    { id: 5, case_id: 1, subject_type: 'person', subject_id: 2, statement: 'The van driver says he moved off when his light went green.', observed_at: oct3('21:40:11'), author_id: null, ...aiPending },
    { id: 6, case_id: 1, subject_type: 'location', subject_id: 1, statement: 'Ring Road was amber from 21:40:08 and red from 21:40:11; 5th Avenue turned green at 21:40:13.', observed_at: oct3('21:40:08'), author_id: null, ...aiConfirmed },
    { id: 7, case_id: 1, subject_type: 'person', subject_id: 1, statement: 'Rohan Kapoor has a fractured right clavicle and a 3 cm forehead laceration; no alcohol detected.', observed_at: oct3('22:05:00'), author_id: null, ...aiConfirmed },
    { id: 8, case_id: 1, subject_type: 'object', subject_id: 2, statement: 'By the camera clock, the van moved off at 21:40:11. The camera clock has not been checked against the signal controller.', observed_at: oct3('21:40:11'), author_id: null, ...aiPending }
  );

  db.conflicts.push(
    { id: 1, case_id: 1, observation_ids: [1, 2], description: "Witnesses disagree on the hatchback's signal when it entered the junction.", status: 'open' },
    { id: 2, case_id: 1, observation_ids: [3, 4, 5], description: 'Accounts disagree on whether the van moved off before its signal turned green.', status: 'open' }
  );

  // -------------------------------------------------------------------------
  // Evidence links: the source passage behind each record
  // -------------------------------------------------------------------------

  const link = (evidenceId: Id, targetType: RecordType, targetId: Id, passage: string) => {
    const chunk = chunkFor(db, evidenceId, passage);
    if (!chunk) throw new Error(`Seed passage not found in evidence ${evidenceId}: ${passage}`);
    db.links.push({ id: db.links.length + 1, evidence_id: evidenceId, chunk_id: chunk.id, target_type: targetType, target_id: targetId, passage });
  };

  link(4, 'event', 1, 'The white hatchback enters the frame from the left on Ring Road, travelling east.');
  link(4, 'event', 2, 'The blue delivery van arrives at the 5th Avenue stop line and stops.');
  link(4, 'event', 3, "The van's front wheels move about one metre past the stop line.");
  link(8, 'event', 4, 'Ring Road amber, 5th Avenue red.');
  link(8, 'event', 5, 'Ring Road red, 5th Avenue red (all-red phase).');
  link(4, 'event', 6, 'The van moves off into the junction.');
  link(2, 'event', 6, 'The blue delivery van on 5th Avenue started moving before its light turned green.');
  link(4, 'event', 7, "The van strikes the driver's side of the hatchback near the centre of the junction.");
  link(1, 'event', 7, "The van struck the driver's side of the hatchback in the middle of the junction.");
  link(8, 'event', 8, 'Ring Road red, 5th Avenue green.');
  link(4, 'event', 9, 'A cyclist at the north-east corner rides away north along 5th Avenue.');
  link(6, 'event', 10, "There's been an accident at the Ring Road and 5th Avenue junction. A van has hit a car.");
  link(1, 'event', 11, 'Rohan Kapoor was taken to City General Hospital by ambulance at 21:52');
  link(7, 'event', 12, 'Arrived 3 October 2026, 22:05, by ambulance.');
  link(1, 'event', 13, 'skid marks from the hatchback measured 8.4 m before the point of impact.');
  link(2, 'observation', 1, 'Its light was still yellow when it went into the junction.');
  link(3, 'observation', 2, 'The light for Ring Road was red before the car reached the junction, and it did not slow down.');
  link(2, 'observation', 3, 'The blue delivery van on 5th Avenue started moving before its light turned green.');
  link(3, 'observation', 4, 'The delivery van had a green light.');
  link(1, 'observation', 5, 'Suresh Nair stated that he waited at the stop line and moved off when his light went green.');
  link(8, 'observation', 6, 'Ring Road amber, 5th Avenue red.');
  link(7, 'observation', 7, "displaced fracture of the right clavicle, consistent with a side impact on the driver's side.");
  link(4, 'observation', 8, 'The van moves off into the junction.');
  link(2, 'person', 5, 'A man on a bicycle was also waiting at the corner, but he rode off before the police came.');
  link(1, 'object', 3, 'His phone was in a dashboard mount and he says he was not using it.');
  link(1, 'object', 1, 'Vehicle 1: white Maruti Swift hatchback, KA-01-AB-1234, driven by Rohan Kapoor (34), travelling east on Ring Road.');
  link(4, 'object', 1, 'The white hatchback enters the frame from the left on Ring Road, travelling east.');
  link(1, 'object', 2, 'Vehicle 2: blue Tata Ace delivery van, KA-05-CD-5678, driven by Suresh Nair (46), travelling north on 5th Avenue, registered to QuickCart Logistics.');
  link(4, 'object', 2, 'The blue delivery van arrives at the 5th Avenue stop line and stops.');
  link(2, 'relationship', 7, 'Its light was still yellow when it went into the junction.');
  link(3, 'relationship', 7, 'The delivery van had a green light.');
  link(1, 'person', 1, 'Rohan Kapoor stated that his light was amber when he entered the junction.');
  link(10, 'event', 14, 'A dark hatchback hit a man crossing behind my bus at about 23:15.');

  // -------------------------------------------------------------------------
  // Injuries (M5)
  // -------------------------------------------------------------------------

  db.injuries.push(
    { id: 1, case_id: 1, person_id: 1, body_region: 'chest', structure_id: 'clavicle_right', type: 'Fracture', severity: 'moderate', depth: null, estimated_time: oct3('21:40:12'), description: 'Displaced fracture of the right clavicle, consistent with a driver-side impact.', ...aiConfirmed },
    { id: 2, case_id: 1, person_id: 1, body_region: 'head', structure_id: null, type: 'Laceration', severity: 'minor', depth: '3 cm long', estimated_time: oct3('21:40:12'), description: 'Forehead laceration, sutured.', ...aiConfirmed },
    { id: 3, case_id: 1, person_id: 1, body_region: 'right_arm', structure_id: null, type: 'Bruising', severity: 'minor', depth: null, estimated_time: oct3('21:40:12'), description: 'Bruising to the right upper arm.', ...aiPending }
  );
  link(7, 'injury', 1, "displaced fracture of the right clavicle, consistent with a side impact on the driver's side.");
  link(7, 'injury', 2, 'laceration of the forehead, 3 cm, sutured.');
  link(7, 'injury', 3, 'bruising to the right upper arm.');

  // -------------------------------------------------------------------------
  // Reconstructions: two competing scenarios
  // -------------------------------------------------------------------------

  const HALF_PI = Math.PI / 2;
  db.reconstructions.push(
    {
      id: 1,
      case_id: 1,
      scenario: 'Van moved off before its green',
      version: 1,
      assumptions:
        'The hatchback entered on amber at about 21:40:09. The van moved off during the all-red phase at 21:40:11. Assumes the camera clock matches the signal controller. Supported by Anita Desai and the signal log.',
      scene_file: 'road-accident/junction.json'
    },
    {
      id: 2,
      case_id: 1,
      scenario: 'Hatchback entered on red',
      version: 1,
      assumptions:
        'The hatchback entered after 21:40:11 on red. The van moved off on green at 21:40:13. Assumes the camera clock runs about 2 seconds behind the signal controller. Supported by Vikram Singh.',
      scene_file: 'road-accident/junction.json'
    }
  );
  db.stages.push(
    { id: 1, reconstruction_id: 1, stage_order: 1, label: 'Approach', event_ids: [1, 2, 3, 4] },
    { id: 2, reconstruction_id: 1, stage_order: 2, label: 'Impact', event_ids: [5, 6, 7] },
    { id: 3, reconstruction_id: 1, stage_order: 3, label: 'Rest positions', event_ids: [8, 10, 11] },
    { id: 4, reconstruction_id: 2, stage_order: 1, label: 'Approach', event_ids: [1, 2, 5] },
    { id: 5, reconstruction_id: 2, stage_order: 2, label: 'Impact', event_ids: [7, 8] }
  );
  const placements: [Id, Id, [number, number, number], number][] = [
    // stage, object, position (metres from the junction centre; x east, z south), heading (radians)
    [1, 1, [-25, 0, -1.75], 0], [1, 2, [-1.75, 0, 9], HALF_PI],
    [2, 1, [-1, 0, -1.75], 0], [2, 2, [-1.75, 0, 0.5], HALF_PI],
    [3, 1, [6, 0, -5], 0.4], [3, 2, [-1.5, 0, -1], HALF_PI + 0.2],
    [4, 1, [-30, 0, -1.75], 0], [4, 2, [-1.75, 0, 8], HALF_PI],
    [5, 1, [-1, 0, -1.75], 0], [5, 2, [-1.75, 0, 0.5], HALF_PI]
  ];
  placements.forEach(([stageId, objectId, position, heading], index) =>
    db.sceneObjects.push({
      id: index + 1,
      stage_id: stageId,
      model_id: objectId === 1 ? 'hatchback' : 'delivery-van',
      object_id: objectId,
      label: objectId === 1 ? 'White hatchback' : 'Delivery van',
      position,
      rotation: [0, heading, 0],
      scale: [1, 1, 1]
    })
  );
  db.annotations.push(
    { id: 1, reconstruction_id: 1, stage_id: 2, kind: 'measurement', data: { label: 'Hatchback skid marks', from: [-9.4, 0, -1.75], to: [-1, 0, -1.75], length_m: 8.4 } },
    { id: 2, reconstruction_id: 1, stage_id: null, kind: 'viewpoint', data: { label: "Anita Desai's view", position: [8, 1.6, -8], target: [0, 0, 0] } },
    { id: 3, reconstruction_id: 1, stage_id: null, kind: 'note', data: { text: 'Camera clock offset not yet checked against the signal controller.' } }
  );

  // -------------------------------------------------------------------------
  // Audit trail
  // -------------------------------------------------------------------------

  addAudit(db, 2, 'viewed', 'evidence', 4, null, at('10-04', '11:00:00'));
  addAudit(db, 1, 'reviewed', 'event', 2, { review_status: { before: 'pending', after: 'confirmed' } }, at('10-05', '10:15:00'));
  addAudit(db, 1, 'reviewed', 'event', 3, { review_status: { before: 'pending', after: 'confirmed' } }, at('10-05', '10:16:00'));
  addAudit(db, 1, 'modified', 'case', 1, { status: { before: 'open', after: 'in_progress' } }, at('10-05', '11:20:00'));
  db.audit.sort((a, b) => a.at.localeCompare(b.at));
  db.audit.forEach((entry, index) => (entry.id = index + 1));

  return db;
};
