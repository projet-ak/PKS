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

interface ArucoDictionary {
  codeList: string[];
  /// Verilen ID icin yazdirmaya hazir marker SVG'si uretir.
  generateSVG(id: number): string;
}

interface ArucoDictionaryConstructor {
  new (dictionaryName: string): ArucoDictionary;
}

declare const AR: {
  Detector: ArucoDetectorConstructor;
  Dictionary: ArucoDictionaryConstructor;
};
