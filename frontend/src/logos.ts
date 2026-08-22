// Logolar src altindan import edilir: Vite bunlari hash'li isimlerle assets/
// klasorune koyar. public/ altinda dursalardi sunucuda ayri bir symlink
// gerekirdi ve eksik kalinca sessizce 404 verirlerdi.
import holdingWhite from "./assets/ern-holding-beyaz.png";
import holdingColor from "./assets/ern-holding.png";
import taahhutWhite from "./assets/ern-taahhut-beyaz.png";
import taahhutColor from "./assets/ern-taahhut.png";

export const LOGOS = {
  holdingWhite,
  holdingColor,
  taahhutWhite,
  taahhutColor,
};

/// Alt bilgilerde ve giris ekraninda gosterilen ibareler. Ingilizce
/// tutuluyor; cikti ve ekranlar kurum disina da gidebiliyor.
export const CONCEPT = "Ömer Faruk Kaya";
export const DEVELOPER = "Tayyar Akbulut";
