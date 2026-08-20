// js-aruco2 tip tanimi ile gelmiyor ve modul olarak export etmiyor;
// public/vendor altindan klasik script olarak yuklenir ve global AR'i tanimlar.
interface ArucoMarker {
  id: number;
  corners: { x: number; y: number }[];
}

interface ArucoDetector {
  detect(imageData: ImageData): ArucoMarker[];
}

interface ArucoDetectorConstructor {
  new (config?: { dictionaryName?: string; maxHammingDistance?: number }): ArucoDetector;
}

declare const AR: {
  Detector: ArucoDetectorConstructor;
};
