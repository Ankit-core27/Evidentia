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
  walking: {
    joints: {
      hip_l: [0, 0, 0.35],
      knee_l: [0, 0, -0.08],
      ankle_l: [0, 0, -0.12],
      hip_r: [0, 0, -0.3],
      knee_r: [0, 0, -0.25],
      ankle_r: [0, 0, 0.2],
      shoulder_l: [0, 0, -0.25],
      elbow_l: [0, 0, 0.15],
      shoulder_r: [0, 0, 0.3],
      elbow_r: [0, 0, 0.35]
    },
    drop: -0.03
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
    drop: -0.08
  },
  seated: {
    joints: {
      hip_l: [0, 0, 1.5],
      knee_l: [0, 0, -1.5],
      hip_r: [0, 0, 1.5],
      knee_r: [0, 0, -1.5],
      shoulder_l: [0, 0, 0.35],
      elbow_l: [0, 0, 1.0],
      shoulder_r: [0, 0, 0.35],
      elbow_r: [0, 0, 1.0]
    },
    drop: -0.35
  },
  crouching: {
    joints: {
      spine: [0, 0, -0.35],
      chest: [0, 0, -0.2],
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
    drop: -0.5
  },
  lying: {
    joints: {
      pelvis: [Math.PI, 0, -Math.PI / 2],
      shoulder_l: [0.15, 0, 0],
      shoulder_r: [-0.15, 0, 0],
      ankle_l: [0, 0, -0.4],
      ankle_r: [0, 0, -0.4]
    },
    drop: -0.83
  },
  cycling: {
    joints: {
      pelvis: [0, 0, -0.35],
      spine: [0, 0, -0.15],
      chest: [0, 0, -0.1],
      neck: [0, 0, 0.35],
      head: [0, 0, 0.3],
      hip_l: [0, 0, 1.3],
      knee_l: [0, 0, -0.9],
      hip_r: [0, 0, 0.6],
      knee_r: [0, 0, -1.2],
      shoulder_l: [0, 0, 0.9],
      elbow_l: [0, 0, 0.4],
      shoulder_r: [0, 0, 0.9],
      elbow_r: [0, 0, 0.4]
    },
    drop: 0.12
  },
  riding: {
    joints: {
      pelvis: [0, 0, -0.15],
      spine: [0, 0, -0.1],
      neck: [0, 0, 0.1],
      head: [0, 0, 0.12],
      hip_l: [0.15, 0, 1.2],
      knee_l: [0, 0, -1.4],
      hip_r: [-0.15, 0, 1.2],
      knee_r: [0, 0, -1.4],
      shoulder_l: [0.1, 0, 0.9],
      elbow_l: [0, 0, 0.5],
      shoulder_r: [-0.1, 0, 0.9],
      elbow_r: [0, 0, 0.5]
    },
    drop: -0.07
  },
  driving: {
    joints: {
      pelvis: [0, 0, 0.25],
      hip_l: [0, 0, 1.4],
      knee_l: [0, 0, -1.0],
      hip_r: [0, 0, 1.4],
      knee_r: [0, 0, -1.0],
      shoulder_l: [0, 0, 0.85],
      elbow_l: [0, 0, 0.7],
      shoulder_r: [0, 0, 0.85],
      elbow_r: [0, 0, 0.7]
    },
    drop: -0.55
  },
  pointing: {
    joints: {
      head: [0, -0.15, 0],
      shoulder_r: [0, 0, 1.5],
      elbow_r: [0, 0, 0.05]
    }
  },
  hands_raised: {
    joints: {
      shoulder_l: [1.45, Math.PI / 2, 0],
      elbow_l: [0, 0, 1.5],
      shoulder_r: [-1.45, -Math.PI / 2, 0],
      elbow_r: [0, 0, 1.5]
    }
  }
};
