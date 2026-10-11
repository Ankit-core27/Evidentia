// Authored layouts of the inspectable buildings. The first two are at the Ring Road and 5th Avenue junction
// (case FX-2026-0001). They are illustrative: no survey or floor plan of the real buildings
// exists in the case records, so the area view labels them as authored models.
//
// Model frame: metres, origin on the ground at the centre of the footprint, +x east,
// -z north, +y up. Wall openings are { c, w, bottom, top } with c measured along the wall's
// axis in model coordinates. Rooms, walls and furniture are given per floor.

export const cornerStore = {
  id: 'corner-store',
  name: 'Corner store',
  use: 'Shop with residence above',
  geo_building_id: 'fx-junction-sw-01',
  anchor: { lat: 12.97125, lng: 77.59425, heading_deg: 0 },
  width: 10,
  depth: 8,
  floorHeight: 3.2,
  colours: { wall: 0xc9b99a, wallInt: 0xe4ddd0 },
  hole: [3.7, -1.0, 4.75, 3.75],
  floors: [
    {
      label: 'Ground floor · shop',
      rooms: [
        { id: 'shop', label: 'Shop floor', type: 'shop', box: [-4.75, -3.75, 2.8, 1.5] },
        { id: 'store', label: 'Storeroom', type: 'storage', box: [-4.75, 1.5, 0.5, 3.75] },
        { id: 'wc', label: 'Toilet', type: 'bath', box: [0.5, 1.5, 2.8, 3.75] },
        { id: 'passage', label: 'Stair passage', type: 'corridor', box: [2.8, -3.75, 4.75, 3.75] }
      ],
      ext: {
        north: [
          { c: -1.0, w: 3.0, bottom: 0, top: 2.6, kind: 'shutter', id: 'shopfront', label: 'Shopfront shutter' },
          { c: 3.75, w: 1.0, bottom: 0, top: 2.2, kind: 'door', id: 'side_entrance', label: 'Side entrance to stairs' }
        ],
        east: [{ c: 1.5, w: 1.0, bottom: 1.2, top: 2.0, kind: 'window' }],
        south: [{ c: 1.6, w: 0.6, bottom: 1.6, top: 2.1, kind: 'window' }],
        west: [
          { c: -1.5, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 2.6, w: 0.6, bottom: 1.6, top: 2.1, kind: 'window' }
        ]
      },
      int: [
        { id: 'shop_rear', label: 'Shop rear wall', axis: 'x', at: 1.5, from: -4.75, to: 2.8, dir: [0, 0, 1], openings: [
          { c: -2.0, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'store', label: 'Storeroom door' },
          { c: 1.6, w: 0.8, bottom: 0, top: 2.1, kind: 'door', id: 'wc', label: 'Toilet door' }
        ] },
        { id: 'store_wc', label: 'Storeroom and toilet partition', axis: 'z', at: 0.5, from: 1.5, to: 3.75, dir: [-1, 0, 0] },
        { id: 'passage', label: 'Stair passage wall', axis: 'z', at: 2.8, from: -3.75, to: 3.75, dir: [1, 0, 0], openings: [
          { c: -2.5, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'passage', label: 'Shop to stair passage door' }
        ] }
      ],
      furniture: [
        { id: 'counter', label: 'Sales counter', type: 'counter', room: 'shop', x: 1.8, z: -1.0, w: 2.4, d: 0.6, rot: 1 },
        { id: 'shelf_w1', label: 'Wall shelving, west (front)', type: 'shelf', room: 'shop', x: -4.45, z: -2.6, w: 1.8, d: 0.45, rot: 1 },
        { id: 'shelf_w2', label: 'Wall shelving, west (rear)', type: 'shelf', room: 'shop', x: -4.45, z: -0.5, w: 1.8, d: 0.45, rot: 1 },
        { id: 'shelf_island', label: 'Island shelving', type: 'shelf', room: 'shop', x: -1.6, z: -0.6, w: 2.0, d: 0.5, h: 1.5, rot: 1 },
        { id: 'fridge', label: 'Display refrigerator', type: 'fridge', room: 'shop', x: -0.2, z: 1.1, w: 0.7, d: 0.65, rot: 2 },
        { id: 'stock', label: 'Stacked stock boxes', type: 'boxes', room: 'store', x: -3.6, z: 2.9, w: 1.4, d: 1.0 },
        { id: 'store_shelf', label: 'Storeroom shelving', type: 'shelf', room: 'store', x: -1.0, z: 3.45, w: 1.8, d: 0.45, rot: 2 },
        { id: 'toilet', label: 'Toilet', type: 'toilet', room: 'wc', x: 2.3, z: 3.35, rot: 2 },
        { id: 'basin', label: 'Wash basin', type: 'basin', room: 'wc', x: 1.0, z: 3.5, rot: 2 }
      ],
      stairs: { label: 'Stairs to first floor', box: [3.7, -1.0, 4.75, 3.75], run: 'z-' }
    },
    {
      label: 'First floor · residence',
      rooms: [
        { id: 'living', label: 'Living room', type: 'living', box: [-4.75, -3.75, 0.5, 0.5] },
        { id: 'kitchen', label: 'Kitchen', type: 'kitchen', box: [0.5, -3.75, 2.8, 0.5] },
        { id: 'bedroom', label: 'Bedroom', type: 'bedroom', box: [-4.75, 0.5, 0.5, 3.75] },
        { id: 'bath', label: 'Bathroom', type: 'bath', box: [0.5, 0.5, 2.8, 3.75] },
        { id: 'landing', label: 'Stair landing', type: 'corridor', box: [2.8, -3.75, 4.75, 3.75] }
      ],
      ext: {
        north: [
          { c: -3.0, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 1.6, w: 1.2, bottom: 1.0, top: 2.1, kind: 'window' },
          { c: 3.75, w: 0.8, bottom: 1.2, top: 2.0, kind: 'window' }
        ],
        east: [{ c: -2.0, w: 1.0, bottom: 1.0, top: 2.0, kind: 'window' }],
        south: [
          { c: -2.0, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 1.6, w: 0.6, bottom: 1.6, top: 2.1, kind: 'window' }
        ],
        west: [
          { c: -1.5, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 2.2, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' }
        ]
      },
      int: [
        { id: 'landing', label: 'Landing wall', axis: 'z', at: 2.8, from: -3.75, to: 3.75, dir: [1, 0, 0], openings: [
          { c: -2.8, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'flat', label: 'Flat entrance door' }
        ] },
        { id: 'kitchen', label: 'Kitchen wall', axis: 'z', at: 0.5, from: -3.75, to: 0.5, dir: [0, 0, -1], openings: [
          { c: -1.5, w: 1.2, bottom: 0, top: 2.2, kind: 'opening' }
        ] },
        { id: 'bedroom', label: 'Bedroom and bathroom wall', axis: 'x', at: 0.5, from: -4.75, to: 2.8, dir: [0, 0, 1], openings: [
          { c: -1.0, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'bedroom', label: 'Bedroom door' },
          { c: 1.6, w: 0.8, bottom: 0, top: 2.1, kind: 'door', id: 'bath', label: 'Bathroom door' }
        ] },
        { id: 'bath', label: 'Bathroom partition', axis: 'z', at: 0.5, from: 0.5, to: 3.75, dir: [-1, 0, 0] }
      ],
      furniture: [
        { id: 'sofa', label: 'Sofa', type: 'sofa', room: 'living', x: -2.6, z: -3.25, w: 2.0, d: 0.85 },
        { id: 'coffee_table', label: 'Coffee table', type: 'table', room: 'living', x: -2.6, z: -2.0, w: 1.0, d: 0.6, h: 0.45 },
        { id: 'tv_unit', label: 'TV unit', type: 'cabinet', room: 'living', x: -2.6, z: 0.25, w: 1.6, d: 0.4, h: 0.6 },
        { id: 'kitchen_counter', label: 'Kitchen counter', type: 'kitchen', room: 'kitchen', x: 1.65, z: -3.4, w: 2.1, d: 0.6 },
        { id: 'kitchen_fridge', label: 'Refrigerator', type: 'fridge', room: 'kitchen', x: 2.35, z: 0.05, w: 0.65, d: 0.65, rot: 2 },
        { id: 'bed', label: 'Double bed', type: 'bed', room: 'bedroom', x: -2.4, z: 2.7, w: 1.6, d: 2.0, rot: 2 },
        { id: 'wardrobe', label: 'Wardrobe', type: 'wardrobe', room: 'bedroom', x: -4.4, z: 1.4, w: 1.2, d: 0.6, rot: 1 },
        { id: 'bath_toilet', label: 'Toilet', type: 'toilet', room: 'bath', x: 2.3, z: 3.35, rot: 2 },
        { id: 'bath_basin', label: 'Wash basin', type: 'basin', room: 'bath', x: 1.0, z: 3.5, rot: 2 }
      ]
    }
  ],
  roof: { parapet: 0.9, fixtures: [{ id: 'water_tank', label: 'Water tank', type: 'tank', x: 3.6, z: 2.6 }] }
};

export const officeBlock = {
  id: 'office-block',
  name: 'Office block',
  use: 'Commercial offices',
  geo_building_id: 'fx-junction-ne-01',
  anchor: { lat: 12.97203, lng: 77.59478, heading_deg: 0 },
  width: 14,
  depth: 10,
  floorHeight: 3.5,
  colours: { wall: 0x8f9aa3, wallInt: 0xdedfdc },
  hole: [5.65, -4.75, 6.75, 0.65],
  floors: [
    {
      label: 'Ground floor · lobby',
      rooms: [
        { id: 'lobby', label: 'Entrance lobby', type: 'lobby', box: [-6.75, 0.5, 4.4, 4.75] },
        { id: 'security', label: 'Security room', type: 'security', box: [-6.75, -4.75, -2.0, 0.5] },
        { id: 'cafe', label: 'Café', type: 'cafe', box: [-2.0, -4.75, 4.4, 0.5] },
        { id: 'core', label: 'Stair core', type: 'corridor', box: [4.4, -4.75, 6.75, 4.75] }
      ],
      ext: {
        south: [
          { c: -5.0, w: 2.0, bottom: 0.6, top: 2.8, kind: 'window' },
          { c: -1.0, w: 1.8, bottom: 0, top: 2.4, kind: 'door', id: 'main_entrance', label: 'Main entrance' },
          { c: 2.5, w: 2.0, bottom: 0.6, top: 2.8, kind: 'window' },
          { c: 5.6, w: 0.8, bottom: 1.0, top: 2.4, kind: 'window' }
        ],
        north: [
          { c: -4.5, w: 1.5, bottom: 1.0, top: 2.4, kind: 'window' },
          { c: 1.0, w: 2.5, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 5.0, w: 0.9, bottom: 0, top: 2.2, kind: 'door', id: 'service', label: 'Service door' }
        ],
        west: [
          { c: -2.5, w: 1.5, bottom: 1.0, top: 2.4, kind: 'window' },
          { c: 2.5, w: 2.0, bottom: 0.6, top: 2.8, kind: 'window' }
        ],
        east: [{ c: 3.0, w: 1.0, bottom: 1.0, top: 2.4, kind: 'window' }]
      },
      int: [
        { id: 'lobby', label: 'Lobby rear wall', axis: 'x', at: 0.5, from: -6.75, to: 4.4, dir: [0, 0, -1], openings: [
          { c: -4.5, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'security', label: 'Security room door' },
          { c: 1.0, w: 1.8, bottom: 0, top: 2.4, kind: 'opening' }
        ] },
        { id: 'security', label: 'Security room partition', axis: 'z', at: -2.0, from: -4.75, to: 0.5, dir: [-1, 0, 0] },
        { id: 'core', label: 'Stair core wall', axis: 'z', at: 4.4, from: -4.75, to: 4.75, dir: [1, 0, 0], openings: [
          { c: 2.5, w: 1.5, bottom: 0, top: 2.4, kind: 'opening' }
        ] }
      ],
      furniture: [
        { id: 'reception', label: 'Reception desk', type: 'reception', room: 'lobby', x: -1.0, z: 2.0, w: 2.4, d: 0.8 },
        { id: 'lobby_sofa', label: 'Waiting sofa', type: 'sofa', room: 'lobby', x: -5.0, z: 1.3, w: 2.0, d: 0.85 },
        { id: 'security_desk', label: 'Security desk', type: 'desk', room: 'security', x: -4.5, z: -4.2, w: 1.4, d: 0.7 },
        { id: 'security_chair', label: 'Chair', type: 'chair', room: 'security', x: -4.5, z: -3.4, rot: 2 },
        { id: 'security_cabinet', label: 'Filing cabinet', type: 'cabinet', room: 'security', x: -6.3, z: -1.5, w: 1.0, d: 0.5, h: 1.3, rot: 1 },
        { id: 'cafe_counter', label: 'Café counter', type: 'counter', room: 'cafe', x: 1.2, z: -4.3, w: 2.6, d: 0.6 },
        { id: 'cafe_table_1', label: 'Café table', type: 'table', room: 'cafe', x: -0.4, z: -1.8, w: 0.9, d: 0.9 },
        { id: 'cafe_table_2', label: 'Café table', type: 'table', room: 'cafe', x: 2.4, z: -1.8, w: 0.9, d: 0.9 },
        { id: 'cafe_chair_1', label: 'Chair', type: 'chair', room: 'cafe', x: -0.4, z: -2.6 },
        { id: 'cafe_chair_2', label: 'Chair', type: 'chair', room: 'cafe', x: -0.4, z: -1.0, rot: 2 },
        { id: 'cafe_chair_3', label: 'Chair', type: 'chair', room: 'cafe', x: 2.4, z: -2.6 },
        { id: 'cafe_chair_4', label: 'Chair', type: 'chair', room: 'cafe', x: 2.4, z: -1.0, rot: 2 }
      ],
      stairs: { label: 'Stairs to first floor', box: [5.65, -4.75, 6.75, 0.65], run: 'z+' }
    },
    {
      label: 'First floor · open office',
      rooms: [
        { id: 'office', label: 'Open-plan office', type: 'office', boxes: [[-2.5, -4.75, 4.4, 4.75], [-6.75, -4.75, -2.5, 1.0]] },
        { id: 'meeting', label: 'Meeting room', type: 'meeting', box: [-6.75, 1.0, -2.5, 4.75] },
        { id: 'core', label: 'Stair core', type: 'corridor', box: [4.4, -4.75, 6.75, 4.75] }
      ],
      ext: {
        south: [
          { c: -4.6, w: 2.6, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 0.5, w: 2.6, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 3.2, w: 1.6, bottom: 0.9, top: 2.6, kind: 'window' }
        ],
        north: [
          { c: -4.5, w: 2.6, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 0.0, w: 2.6, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 3.2, w: 1.6, bottom: 0.9, top: 2.6, kind: 'window' }
        ],
        west: [
          { c: -2.5, w: 2.0, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 2.9, w: 2.0, bottom: 0.9, top: 2.6, kind: 'window' }
        ],
        east: [{ c: 3.0, w: 1.0, bottom: 1.0, top: 2.4, kind: 'window' }]
      },
      int: [
        { id: 'meeting', label: 'Meeting room wall', axis: 'x', at: 1.0, from: -6.75, to: -2.5, dir: [0, 0, -1], openings: [
          { c: -3.3, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'meeting', label: 'Meeting room door' }
        ] },
        { id: 'meeting_side', label: 'Meeting room side wall', axis: 'z', at: -2.5, from: 1.0, to: 4.75, dir: [1, 0, 0] },
        { id: 'core', label: 'Stair core wall', axis: 'z', at: 4.4, from: -4.75, to: 4.75, dir: [1, 0, 0], openings: [
          { c: 2.5, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'office', label: 'Office door' }
        ] }
      ],
      furniture: [
        ...[-5, -2.5, 0, 2.5].flatMap((x, i) => [
          { id: `desk_a${i + 1}`, label: `Workstation A${i + 1}`, type: 'desk', room: 'office', x, z: -3.9, w: 1.4, d: 0.7 },
          { id: `chair_a${i + 1}`, label: 'Office chair', type: 'chair', room: 'office', x, z: -3.1, rot: 2 },
          { id: `desk_b${i + 1}`, label: `Workstation B${i + 1}`, type: 'desk', room: 'office', x, z: -1.4, w: 1.4, d: 0.7 },
          { id: `chair_b${i + 1}`, label: 'Office chair', type: 'chair', room: 'office', x, z: -0.6, rot: 2 }
        ]),
        { id: 'desk_c1', label: 'Workstation C1', type: 'desk', room: 'office', x: 0.0, z: 3.0, w: 1.4, d: 0.7 },
        { id: 'desk_c2', label: 'Workstation C2', type: 'desk', room: 'office', x: 2.5, z: 3.0, w: 1.4, d: 0.7 },
        { id: 'meeting_table', label: 'Meeting table', type: 'table', room: 'meeting', x: -4.6, z: 2.9, w: 2.4, d: 1.1 },
        ...[-5.4, -3.8].flatMap((x, i) => [
          { id: `meeting_chair_n${i + 1}`, label: 'Chair', type: 'chair', room: 'meeting', x, z: 2.0 },
          { id: `meeting_chair_s${i + 1}`, label: 'Chair', type: 'chair', room: 'meeting', x, z: 3.8, rot: 2 }
        ])
      ],
      stairs: { label: 'Stairs to second floor', box: [5.65, -4.75, 6.75, 0.65], run: 'z+' }
    },
    {
      label: 'Second floor · offices',
      rooms: [
        { id: 'director', label: "Director's office", type: 'office', box: [-6.75, -4.75, -1.5, 0.5] },
        { id: 'server', label: 'Server room', type: 'server', box: [-6.75, 0.5, -3.5, 4.75] },
        { id: 'records', label: 'Records room', type: 'storage', box: [-3.5, 0.5, -1.5, 4.75] },
        { id: 'office', label: 'Open-plan office', type: 'office', box: [-1.5, -4.75, 4.4, 4.75] },
        { id: 'core', label: 'Stair landing', type: 'corridor', box: [4.4, -4.75, 6.75, 4.75] }
      ],
      ext: {
        south: [
          { c: -5.1, w: 1.0, bottom: 1.4, top: 2.2, kind: 'window' },
          { c: 0.5, w: 2.6, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 3.2, w: 1.6, bottom: 0.9, top: 2.6, kind: 'window' }
        ],
        north: [
          { c: -4.1, w: 2.6, bottom: 0.9, top: 2.6, kind: 'window' },
          { c: 1.4, w: 2.6, bottom: 0.9, top: 2.6, kind: 'window' }
        ],
        west: [{ c: -2.2, w: 2.0, bottom: 0.9, top: 2.6, kind: 'window' }],
        east: [{ c: 3.0, w: 1.0, bottom: 1.0, top: 2.4, kind: 'window' }]
      },
      int: [
        { id: 'director', label: 'Director’s office wall', axis: 'z', at: -1.5, from: -4.75, to: 4.75, dir: [-1, 0, 0], openings: [
          { c: -1.0, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'director', label: 'Director’s office door' },
          { c: 2.5, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'records', label: 'Records room door' }
        ] },
        { id: 'server_front', label: 'Server and records wall', axis: 'x', at: 0.5, from: -6.75, to: -1.5, dir: [0, 0, 1] },
        { id: 'server_side', label: 'Server room partition', axis: 'z', at: -3.5, from: 0.5, to: 4.75, dir: [0, 0, 1], openings: [
          { c: 3.6, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'server', label: 'Server room door' }
        ] },
        { id: 'core', label: 'Stair core wall', axis: 'z', at: 4.4, from: -4.75, to: 4.75, dir: [1, 0, 0], openings: [
          { c: 2.5, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'office', label: 'Office door' }
        ] }
      ],
      furniture: [
        { id: 'director_desk', label: 'Director’s desk', type: 'desk', room: 'director', x: -4.2, z: -3.7, w: 1.8, d: 0.8 },
        { id: 'director_chair', label: 'Office chair', type: 'chair', room: 'director', x: -4.2, z: -2.8, rot: 2 },
        { id: 'director_sofa', label: 'Sofa', type: 'sofa', room: 'director', x: -4.2, z: -0.1, w: 1.8, d: 0.8, rot: 2 },
        { id: 'director_cabinet', label: 'Filing cabinet', type: 'cabinet', room: 'director', x: -6.4, z: -2.0, w: 1.2, d: 0.45, h: 1.3, rot: 1 },
        ...[1.3, 2.1, 2.9].map((z, i) => ({ id: `server_rack_${i + 1}`, label: `Server rack ${i + 1}`, type: 'rack', room: 'server', x: -6.1, z, w: 0.6, d: 1.0, rot: 1 })),
        { id: 'records_shelf_1', label: 'Records shelving', type: 'shelf', room: 'records', x: -1.85, z: 1.8, w: 1.8, d: 0.45, rot: 1 },
        { id: 'records_shelf_2', label: 'Records shelving', type: 'shelf', room: 'records', x: -3.15, z: 1.8, w: 1.8, d: 0.45, rot: 1 },
        ...[[0.5, -3.7], [2.8, -3.7], [0.5, -0.9], [2.8, -0.9], [0.5, 2.4], [2.8, 2.4]].flatMap(([x, z], i) => [
          { id: `desk_d${i + 1}`, label: `Workstation D${i + 1}`, type: 'desk', room: 'office', x, z, w: 1.4, d: 0.7 },
          { id: `chair_d${i + 1}`, label: 'Office chair', type: 'chair', room: 'office', x, z: z + 0.8, rot: 2 }
        ])
      ]
    }
  ],
  roof: {
    parapet: 1.0,
    fixtures: [
      { id: 'water_tank_1', label: 'Water tank', type: 'tank', x: -5.0, z: 3.0 },
      { id: 'water_tank_2', label: 'Water tank', type: 'tank', x: -3.4, z: 3.0 },
      { id: 'ac_unit_1', label: 'Air-conditioning unit', type: 'cabinet', x: 1.0, z: -3.5, w: 1.0, d: 0.8, h: 1.0 },
      { id: 'ac_unit_2', label: 'Air-conditioning unit', type: 'cabinet', x: 2.6, z: -3.5, w: 1.0, d: 0.8, h: 1.0 }
    ]
  }
};

// Two inspectable buildings at Sahyadri Chowk (case FX-2026-0005), at the corners the FIR's
// scene survey names: Shinde Tea Stall at the north-west corner (the informant's stall) and
// the pharmacy at the south-east corner. Like the junction buildings above they are
// illustrative: the survey places them, but no floor plan of either exists in the records.
// Anchors are the survey's metres from the junction centre (18.5058 N, 73.8083 E).

export const teaStall = {
  id: 'shinde-tea-stall',
  name: 'Shinde Tea Stall',
  use: 'Tea stall with residence above',
  geo_building_id: 'sahyadri-nw-01',
  anchor: { lat: 18.505894, lng: 73.808201, heading_deg: 0 },
  width: 7,
  depth: 6,
  floorHeight: 3.1,
  colours: { wall: 0xd6c6a4, wallInt: 0xe8e1d2 },
  hole: [2.25, -2.75, 3.25, 0.5],
  floors: [
    {
      label: 'Ground floor · tea stall',
      rooms: [
        { id: 'stall', label: 'Tea stall', type: 'cafe', box: [-3.25, -0.5, 2.2, 2.75] },
        { id: 'store', label: 'Store and stove room', type: 'kitchen', box: [-3.25, -2.75, 2.2, -0.5] },
        { id: 'passage', label: 'Stair passage', type: 'corridor', box: [2.2, -2.75, 3.25, 2.75] }
      ],
      ext: {
        south: [
          { c: -0.8, w: 3.2, bottom: 0, top: 2.6, kind: 'shutter', id: 'stall_front', label: 'Tea stall shutter, facing Karve Road' },
          { c: 2.7, w: 0.9, bottom: 0, top: 2.2, kind: 'door', id: 'side_entrance', label: 'Side entrance to stairs' }
        ],
        east: [{ c: 0.0, w: 1.0, bottom: 1.2, top: 2.0, kind: 'window' }],
        north: [{ c: -1.0, w: 0.8, bottom: 1.4, top: 2.0, kind: 'window' }]
      },
      int: [
        { id: 'store', label: 'Store wall', axis: 'x', at: -0.5, from: -3.25, to: 2.2, dir: [0, 0, -1], openings: [
          { c: -1.5, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'store', label: 'Store door' }
        ] },
        { id: 'passage', label: 'Stair passage wall', axis: 'z', at: 2.2, from: -2.75, to: 2.75, dir: [1, 0, 0], openings: [
          { c: 1.8, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'passage', label: 'Stall to stair passage door' }
        ] }
      ],
      furniture: [
        { id: 'counter', label: 'Tea counter', type: 'counter', room: 'stall', x: -0.8, z: 2.0, w: 2.6, d: 0.6 },
        { id: 'bench_table', label: 'Customer table', type: 'table', room: 'stall', x: -2.4, z: 0.6, w: 1.0, d: 0.6 },
        { id: 'stove', label: 'Stove counter', type: 'kitchen', room: 'store', x: 0.6, z: -2.4, w: 2.0, d: 0.6 },
        { id: 'milk_fridge', label: 'Milk refrigerator', type: 'fridge', room: 'store', x: 1.7, z: -1.0, w: 0.6, d: 0.6, rot: 3 },
        { id: 'stock', label: 'Sacks and boxes', type: 'boxes', room: 'store', x: -2.4, z: -2.1, w: 1.2, d: 0.8 }
      ],
      stairs: { label: 'Stairs to first floor', box: [2.25, -2.75, 3.25, 0.5], run: 'z-' }
    },
    {
      label: 'First floor · residence',
      rooms: [
        { id: 'living', label: 'Living room', type: 'living', box: [-3.25, 0.25, 2.2, 2.75] },
        { id: 'bedroom', label: 'Bedroom', type: 'bedroom', box: [-3.25, -2.75, 0.0, 0.25] },
        { id: 'kitchen', label: 'Kitchen', type: 'kitchen', box: [0.0, -2.75, 2.2, 0.25] },
        { id: 'landing', label: 'Stair landing', type: 'corridor', box: [2.2, -2.75, 3.25, 2.75] }
      ],
      ext: {
        south: [
          { c: -1.2, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 1.2, w: 1.0, bottom: 0.9, top: 2.1, kind: 'window' }
        ],
        north: [
          { c: -1.6, w: 1.2, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 1.1, w: 0.8, bottom: 1.2, top: 2.0, kind: 'window' }
        ],
        east: [{ c: 1.5, w: 0.9, bottom: 1.0, top: 2.0, kind: 'window' }],
        west: [{ c: -1.2, w: 1.2, bottom: 0.9, top: 2.1, kind: 'window' }]
      },
      int: [
        { id: 'landing', label: 'Landing wall', axis: 'z', at: 2.2, from: -2.75, to: 2.75, dir: [1, 0, 0], openings: [
          { c: 1.6, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'flat', label: 'Flat entrance door' }
        ] },
        { id: 'living', label: 'Living room rear wall', axis: 'x', at: 0.25, from: -3.25, to: 2.2, dir: [0, 0, 1], openings: [
          { c: -1.6, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'bedroom', label: 'Bedroom door' },
          { c: 1.1, w: 1.0, bottom: 0, top: 2.2, kind: 'opening' }
        ] },
        { id: 'kitchen', label: 'Kitchen partition', axis: 'z', at: 0.0, from: -2.75, to: 0.25, dir: [-1, 0, 0] }
      ],
      furniture: [
        { id: 'sofa', label: 'Sofa', type: 'sofa', room: 'living', x: -1.5, z: 2.3, w: 1.8, d: 0.8, rot: 2 },
        { id: 'bed', label: 'Bed', type: 'bed', room: 'bedroom', x: -1.6, z: -1.5, w: 1.4, d: 1.9 },
        { id: 'wardrobe', label: 'Wardrobe', type: 'wardrobe', room: 'bedroom', x: -2.95, z: -0.2, w: 0.8, d: 0.5, rot: 1 },
        { id: 'kitchen_counter', label: 'Kitchen counter', type: 'kitchen', room: 'kitchen', x: 1.1, z: -2.45, w: 1.8, d: 0.6 }
      ]
    }
  ],
  roof: { parapet: 0.9, fixtures: [{ id: 'water_tank', label: 'Water tank', type: 'tank', x: -2.5, z: -2.0 }] }
};

export const pharmacy = {
  id: 'sahyadri-pharmacy',
  name: 'Pharmacy',
  use: 'Pharmacy with clinic above',
  geo_building_id: 'sahyadri-se-01',
  anchor: { lat: 18.505697, lng: 73.808409, heading_deg: 0 },
  width: 9,
  depth: 7,
  floorHeight: 3.3,
  colours: { wall: 0xb9c4c9, wallInt: 0xe2e6e6 },
  hole: [3.15, -1.0, 4.25, 3.25],
  floors: [
    {
      label: 'Ground floor · pharmacy',
      rooms: [
        { id: 'pharmacy', label: 'Pharmacy floor', type: 'shop', box: [-4.25, -3.25, 2.5, 1.0] },
        { id: 'dispensary', label: 'Dispensary store', type: 'storage', box: [-4.25, 1.0, 0.5, 3.25] },
        { id: 'wc', label: 'Toilet', type: 'bath', box: [0.5, 1.0, 2.5, 3.25] },
        { id: 'passage', label: 'Stair passage', type: 'corridor', box: [2.5, -3.25, 4.25, 3.25] }
      ],
      ext: {
        north: [
          { c: -1.2, w: 3.6, bottom: 0, top: 2.6, kind: 'shutter', id: 'pharmacy_front', label: 'Pharmacy front, facing Karve Road' },
          { c: 3.4, w: 0.9, bottom: 0, top: 2.2, kind: 'door', id: 'side_entrance', label: 'Side entrance to the clinic stairs' }
        ],
        west: [{ c: -1.5, w: 1.6, bottom: 0.9, top: 2.2, kind: 'window' }],
        east: [{ c: 2.0, w: 0.8, bottom: 1.2, top: 2.0, kind: 'window' }],
        south: [{ c: -1.8, w: 0.6, bottom: 1.6, top: 2.1, kind: 'window' }]
      },
      int: [
        { id: 'rear', label: 'Pharmacy rear wall', axis: 'x', at: 1.0, from: -4.25, to: 2.5, dir: [0, 0, 1], openings: [
          { c: -1.9, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'dispensary', label: 'Dispensary door' },
          { c: 1.5, w: 0.8, bottom: 0, top: 2.1, kind: 'door', id: 'wc', label: 'Toilet door' }
        ] },
        { id: 'dispensary_wc', label: 'Dispensary and toilet partition', axis: 'z', at: 0.5, from: 1.0, to: 3.25, dir: [-1, 0, 0] },
        { id: 'passage', label: 'Stair passage wall', axis: 'z', at: 2.5, from: -3.25, to: 3.25, dir: [1, 0, 0], openings: [
          { c: -2.4, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'passage', label: 'Pharmacy to stair passage door' }
        ] }
      ],
      furniture: [
        { id: 'counter', label: 'Dispensing counter', type: 'counter', room: 'pharmacy', x: 0.5, z: -0.2, w: 3.0, d: 0.6 },
        { id: 'shelf_w1', label: 'Medicine shelving, west (front)', type: 'shelf', room: 'pharmacy', x: -3.95, z: -2.0, w: 1.8, d: 0.45, rot: 1 },
        { id: 'shelf_w2', label: 'Medicine shelving, west (rear)', type: 'shelf', room: 'pharmacy', x: -3.95, z: 0.0, w: 1.6, d: 0.45, rot: 1 },
        { id: 'medicine_fridge', label: 'Medicine refrigerator', type: 'fridge', room: 'pharmacy', x: 2.0, z: 0.5, w: 0.6, d: 0.6, rot: 2 },
        { id: 'stock', label: 'Stock cartons', type: 'boxes', room: 'dispensary', x: -3.0, z: 2.5, w: 1.4, d: 1.0 },
        { id: 'dispensary_shelf', label: 'Dispensary shelving', type: 'shelf', room: 'dispensary', x: -1.0, z: 2.95, w: 1.8, d: 0.45, rot: 2 },
        { id: 'toilet', label: 'Toilet', type: 'toilet', room: 'wc', x: 2.0, z: 2.85, rot: 2 },
        { id: 'basin', label: 'Wash basin', type: 'basin', room: 'wc', x: 1.0, z: 3.0, rot: 2 }
      ],
      stairs: { label: 'Stairs to the clinic', box: [3.15, -1.0, 4.25, 3.25], run: 'z-' }
    },
    {
      label: 'First floor · clinic',
      rooms: [
        { id: 'waiting', label: 'Waiting room', type: 'lobby', box: [-4.25, -3.25, 0.5, 0.5] },
        { id: 'consult', label: 'Consulting room', type: 'office', box: [-4.25, 0.5, 0.5, 3.25] },
        { id: 'records', label: 'Records room', type: 'storage', box: [0.5, -3.25, 2.5, 0.5] },
        { id: 'bath', label: 'Bathroom', type: 'bath', box: [0.5, 0.5, 2.5, 3.25] },
        { id: 'landing', label: 'Stair landing', type: 'corridor', box: [2.5, -3.25, 4.25, 3.25] }
      ],
      ext: {
        north: [
          { c: -2.8, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 1.5, w: 1.0, bottom: 0.9, top: 2.1, kind: 'window' }
        ],
        west: [
          { c: -1.5, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' },
          { c: 2.0, w: 1.2, bottom: 0.9, top: 2.1, kind: 'window' }
        ],
        south: [{ c: -2.0, w: 1.5, bottom: 0.9, top: 2.1, kind: 'window' }],
        east: [{ c: -2.0, w: 0.9, bottom: 1.0, top: 2.0, kind: 'window' }]
      },
      int: [
        { id: 'landing', label: 'Landing wall', axis: 'z', at: 2.5, from: -3.25, to: 3.25, dir: [1, 0, 0], openings: [
          { c: -2.4, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'clinic', label: 'Clinic entrance door' }
        ] },
        { id: 'consult', label: 'Consulting room wall', axis: 'x', at: 0.5, from: -4.25, to: 2.5, dir: [0, 0, 1], openings: [
          { c: -1.9, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'consult', label: 'Consulting room door' },
          { c: 1.5, w: 0.8, bottom: 0, top: 2.1, kind: 'door', id: 'bath', label: 'Bathroom door' }
        ] },
        { id: 'records', label: 'Records room partition', axis: 'z', at: 0.5, from: -3.25, to: 3.25, dir: [-1, 0, 0], openings: [
          { c: -1.0, w: 0.9, bottom: 0, top: 2.1, kind: 'door', id: 'records', label: 'Records room door' }
        ] }
      ],
      furniture: [
        { id: 'waiting_sofa', label: 'Waiting bench', type: 'sofa', room: 'waiting', x: -2.0, z: -2.8, w: 2.0, d: 0.8 },
        { id: 'waiting_table', label: 'Low table', type: 'table', room: 'waiting', x: -2.0, z: -1.6, w: 0.9, d: 0.5, h: 0.45 },
        { id: 'consult_desk', label: 'Doctor’s desk', type: 'desk', room: 'consult', x: -2.5, z: 2.2, w: 1.4, d: 0.7 },
        { id: 'consult_chair', label: 'Chair', type: 'chair', room: 'consult', x: -2.5, z: 1.4 },
        { id: 'couch', label: 'Examination couch', type: 'bed', room: 'consult', x: -3.7, z: 2.0, w: 0.7, d: 1.8 },
        { id: 'records_cabinet', label: 'Records cabinet', type: 'cabinet', room: 'records', x: 1.5, z: -2.95, w: 1.6, d: 0.45, h: 1.3, rot: 2 },
        { id: 'bath_toilet', label: 'Toilet', type: 'toilet', room: 'bath', x: 2.0, z: 2.85, rot: 2 },
        { id: 'bath_basin', label: 'Wash basin', type: 'basin', room: 'bath', x: 1.0, z: 3.0, rot: 2 }
      ]
    }
  ],
  roof: {
    parapet: 1.0,
    fixtures: [
      { id: 'water_tank', label: 'Water tank', type: 'tank', x: -3.0, z: 2.0 },
      { id: 'ac_unit', label: 'Air-conditioning unit', type: 'cabinet', x: 1.0, z: -2.0, w: 1.0, d: 0.8, h: 1.0 }
    ]
  }
};

/** Footprints shown in the area view with no detailed model behind them. */
export const contextFootprints = [
  { id: 'nw-block', name: 'Commercial block (footprint only)', use: 'Unknown', geo_building_id: 'fx-junction-nw-01', anchor: { lat: 12.97205, lng: 77.5941, heading_deg: 0 }, width: 18, depth: 12, height: 9, floors: 3 },
  { id: 'se-block', name: 'Residential block (footprint only)', use: 'Unknown', geo_building_id: 'fx-junction-se-01', anchor: { lat: 12.97112, lng: 77.595, heading_deg: 0 }, width: 14, depth: 14, height: 12, floors: 4 }
];
