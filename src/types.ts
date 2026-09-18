export type LockState = "ACQUIRING" | "LOCKED" | "TRACKING" | "LOST";
export type GazeDirection = "CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN" | "AVERTED";
export type ThreatLevel = "NORMAL" | "SUSPICIOUS" | "HIGH" | "CRITICAL" | "INFO";
export type TargetCategory = "VIP" | "SUSPECT" | "WANTED" | "AUTHORIZED" | "UNKNOWN";

export interface TargetFace {
  id: string;
  x: number; // normalized 0-1 or pixel
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  speed: number;
  lockState: LockState;
  distanceMeters: number;
  history: Array<{ x: number; y: number; time: number }>;
  
  // Gaze and Head Pose
  yaw: number; // -45 to +45 deg (left to right)
  pitch: number; // -30 to +30 deg (up to down)
  roll: number;
  gazeDirection: GazeDirection;
  isStaringAtCamera: boolean;
  stareDurationSeconds: number;
  
  // Behavior metrics
  firstDetectedAt: number;
  lastDetectedAt: number;
  dwellTimeSeconds: number;
  erraticScore: number; // 0-100%
  
  // Watchlist
  watchlistMatch?: {
    personId: string;
    name: string;
    category: TargetCategory;
    confidence: number;
    avatarUrl?: string;
  };
}

export interface WatchlistPerson {
  id: string;
  name: string;
  alias: string;
  category: TargetCategory;
  photoUrl: string;
  notes: string;
  alertLevel: ThreatLevel;
  featureSignature?: number[]; // simplified normalized color/spatial vector
  enrolledAt: string;
  threatDescription?: string;
}

export interface MobileNotification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  targetName: string;
  category: TargetCategory;
  threatLevel: ThreatLevel;
  snapshotUrl?: string;
  confidence: number;
  gazeInfo: string;
  acknowledged: boolean;
  location: string;
}

export interface PTZState {
  panAngle: number; // -90 deg to +90 deg
  tiltAngle: number; // -45 deg to +45 deg
  targetPan: number;
  targetTilt: number;
  autoTrackEnabled: boolean;
  trackingSpeed: number; // 1-10
  damping: number; // smooth easing
  motorStatus: "IDLE" | "SLEWING" | "LOCKED";
  pwmSignalX: number; // 1000 - 2000 microsec for servo
  pwmSignalY: number;
}

export interface AIAnalysisResult {
  threatScore: number;
  level: ThreatLevel;
  summary: string;
  behaviorDetails: string[];
  intentInference: string;
  recommendedAction: string;
  modelUsed: string;
  analyzedAt: string;
}

export interface VideoSourceOption {
  id: "webcam" | "cctv-entrance" | "cctv-perimeter" | "cctv-hallway";
  name: string;
  description: string;
  iconType: string;
}
