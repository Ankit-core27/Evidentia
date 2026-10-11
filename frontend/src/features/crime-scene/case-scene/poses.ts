// Poses for the mannequin in assets/3d/crime-scenes/library/person.glb. Each joint group's
// rotation is an Euler XYZ triple in radians, applied to the rest pose (standing upright,
// arms relaxed, all rotations zero). The figure faces +x with y up and its left side at -z,
// so a positive z rotation swings a hanging limb forward (hip, shoulder and elbow flexion),
// a negative z rotation bends a knee or leans the trunk forward, and a positive x rotation
// lifts a left limb out to the side (negative x for the right).

export type JointName =
  | 'pelvis'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulder_l'
  | 'elbow_l'
  | 'wrist_l'
  | 'shoulder_r'
  | 'elbow_r'
  | 'wrist_r'
  | 'hip_l'
  | 'knee_l'
  | 'ankle_l'
  | 'hip_r'
  | 'knee_r'
  | 'ankle_r';

export interface Pose {
  joints: Partial<Record<JointName, [number, number, number]>>;
  /** pelvis height offset in metres (negative lowers the body) */
  drop?: number;
}

export const POSES: Record<string, Pose> = {
  standing: {
    joints: {}
  },
  /** Mid-stride: left heel striking, right foot pushing off on its toes. */
  walking: {
    joints: {
      hip_l: [0, 0, 0.35],
      knee_l: [0, 0, -0.08],
      ankle_l: [0, 0, -0.05],
      hip_r: [0, 0, -0.3],
      knee_r: [0, 0, -0.25],
      ankle_r: [0, 0, 0.05],
      shoulder_l: [0, 0, -0.25],
      elbow_l: [0, 0, 0.15],
      shoulder_r: [0, 0, 0.3],
      elbow_r: [0, 0, 0.35]
    },
    drop: -0.017
  },
  running: {
    joints: {
      spine: [0, 0, -0.12],
      chest: [0, 0, -0.05],
      head: [0, 0, 0.12],
      hip_l: [0, 0, 0.85],
      knee_l: [0, 0, -0.55],
      ankle_l: [0, 0, -0.2],
      hip_r: [0, 0, -0.45],
      knee_r: [0, 0, -1.5],
      ankle_r: [0, 0, 0.35],
      shoulder_l: [0, 0, -0.6],
      elbow_l: [0, 0, 1.4],
      shoulder_r: [0, 0, 0.7],
      elbow_r: [0, 0, 1.5]
    },
    drop: -0.14
  },
  /** On a 0.45 m seat: thighs on the seat, shins vertical, feet flat, hands resting on the thighs. */
  seated: {
    joints: {
      hip_l: [0, 0, 1.403],
      knee_l: [0, 0, -1.305],
      ankle_l: [0, 0, -0.098],
      hip_r: [0, 0, 1.403],
      knee_r: [0, 0, -1.305],
      ankle_r: [0, 0, -0.098],
      shoulder_l: [-0.275, 0, 0.125],
      elbow_l: [0, 0, 0.812],
      wrist_l: [0, -1.2, 0],
      shoulder_r: [0.275, 0, 0.125],
      elbow_r: [0, 0, 0.812],
      wrist_r: [0, 1.2, 0]
    },
    drop: -0.335
  },
  /** A deep squat on flat feet, knees apart, leaning forward. */
  crouching: {
    joints: {
      spine: [0, 0, -0.5],
      chest: [0, 0, -0.05],
      neck: [0, 0, 0.2],
      head: [0, 0, 0.25],
      hip_l: [0, 0.25, 1.95],
      knee_l: [0, 0, -2.3],
      ankle_l: [0, 0, 0.35],
      hip_r: [0, -0.25, 1.95],
      knee_r: [0, 0, -2.3],
      ankle_r: [0, 0, 0.35],
      shoulder_l: [0, 0, 0.9],
      elbow_l: [0, 0, 0.5],
      shoulder_r: [0, 0, 0.9],
      elbow_r: [0, 0, 0.5]
    },
    drop: -0.59
  },
  /** On the back, head towards +x. */
  lying: {
    joints: {
      pelvis: [Math.PI, 0, -Math.PI / 2],
      shoulder_l: [0.15, 0, 0],
      shoulder_r: [-0.15, 0, 0],
      ankle_l: [0, 0, -0.4],
      ankle_r: [0, 0, -0.4]
    },
    drop: -0.813
  },
  /** Saddle top 0.95 m; pedals at 3 and 9 o'clock on a crank centred at (0.17, 0.28); hands on bars at (0.55, 1.0). */
  cycling: {
    joints: {
      pelvis: [0, 0, -0.407],
      spine: [0, 0, -0.1],
      neck: [0, 0, 0.3],
      head: [0, 0, 0.25],
      hip_l: [0, 0, 1.295],
      knee_l: [0, 0, -0.951],
      ankle_l: [0, 0, -0.036],
      hip_r: [0, 0, 0.974],
      knee_r: [0, 0, -1.243],
      ankle_r: [0, 0, 0.329],
      shoulder_l: [-0.097, 0, 1.001],
      elbow_l: [0, 0, 0.2],
      shoulder_r: [0.097, 0, 1.001],
      elbow_r: [0, 0, 0.2]
    },
    drop: 0.152
  },
  /** Motorcycle: seat 0.8 m, hands on bars at (0.6, 0.97), feet on pegs at (0.16, 0.33). */
  riding: {
    joints: {
      pelvis: [0, 0, -0.22],
      spine: [0, 0, -0.25],
      neck: [0, 0, 0.42],
      head: [0, 0, 0.1],
      hip_l: [0.2, 0, 1.204],
      knee_l: [0, 0, -1.659],
      ankle_l: [0, 0, 0.657],
      hip_r: [-0.2, 0, 1.204],
      knee_r: [0, 0, -1.659],
      ankle_r: [0, 0, 0.657],
      shoulder_l: [0.418, 0, 1.029],
      elbow_l: [0, 0, 0.25],
      shoulder_r: [-0.418, 0, 1.029],
      elbow_r: [0, 0, 0.25]
    },
    drop: 0.028
  },
  /** At the wheel: car floor at y = 0, seat cushion 0.2 m above it, hands at 9 and 3 on a wheel at (0.45, 0.8). */
  driving: {
    joints: {
      pelvis: [0, 0, 0.25],
      spine: [0, 0, -0.05],
      chest: [0, 0, -0.05],
      neck: [0, 0, -0.08],
      head: [0, 0, -0.07],
      hip_l: [0, 0.06, 1.48],
      knee_l: [0, 0, -0.822],
      ankle_l: [0, 0, -0.558],
      hip_r: [0, -0.06, 1.48],
      knee_r: [0, 0, -0.822],
      ankle_r: [0, 0, -0.558],
      shoulder_l: [-0.478, 0, 1.034],
      elbow_l: [0, 0, 0.677],
      shoulder_r: [0.478, 0, 1.034],
      elbow_r: [0, 0, 0.677]
    },
    drop: -0.576
  },
  pointing: {
    joints: {
      head: [0, -0.15, 0],
      shoulder_r: [0, 0, 1.5],
      elbow_r: [0, 0, 0.05]
    }
  },
  /** Surrender: upper arms out to the sides, forearms up, palms forward. */
  hands_raised: {
    joints: {
      shoulder_l: [1.45, Math.PI / 2, 0],
      elbow_l: [0, 0, 1.5],
      shoulder_r: [-1.45, -Math.PI / 2, 0],
      elbow_r: [0, 0, 1.5]
    }
  }
};
